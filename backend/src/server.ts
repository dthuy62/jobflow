import type { Writable } from "node:stream";
import Fastify, { LogController, type FastifyInstance, type RouteOptions } from "fastify";
import type { Pool } from "pg";
import type { Config } from "./config.js";
import type { AuthService } from "./core/auth-service.js";
import { registerAuth } from "./http/auth-plugin.js";
import { clientErrorHandler, frameworkErrorHandler, registerErrorHandlers } from "./http/error-handler.js";
import { guestLimit, registerIpLimit, registerUserLimit } from "./http/rate-limits.js";
import { registerAuthRoutes } from "./http/routes/auth.js";
import { registerHealthRoutes } from "./http/routes/health.js";
import { registerMeRoutes } from "./http/routes/me.js";
import { serializeError } from "./logging.js";

const TOKEN_FIELDS = ["idToken", "accessToken", "refreshToken", "guestRefreshToken"];
const REDACTED_LOG_PATHS = TOKEN_FIELDS.flatMap((field) => [field, `*.${field}`]);

const BODY_LIMIT_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

export interface ServerDeps {
  readonly config: Config;
  readonly pool: Pick<Pool, "query">;
  readonly auth: AuthService;
  /** Where logs go. Defaults to stdout; tests read them from here. */
  readonly logStream?: Writable;
  readonly registerTestRoutes?: (scope: FastifyInstance) => void;
  /** Lets a test see every route as it registers, to check that none escapes default deny. */
  readonly observeRoute?: (route: RouteOptions) => void;
}

export async function createServer(deps: ServerDeps): Promise<FastifyInstance> {
  const { config, pool, auth, logStream, registerTestRoutes, observeRoute } = deps;
  const server = Fastify({
    logger: {
      level: config.env === "test" && !logStream ? "silent" : "info",
      base: null,
      // Allowlists, in case code logs a request or reply object.
      serializers: {
        err: serializeError,
        req: ({ method }: { method: string }) => ({ method }),
        res: ({ statusCode }: { statusCode: number }) => ({ statusCode })
      },
      // A second net under the allowlists: these never reach a log, whatever logs them.
      redact: { paths: REDACTED_LOG_PATHS, censor: "[REDACTED]" },
      ...(logStream ? { stream: logStream } : {})
    },
    // The onResponse hook below logs an allowlist instead: Fastify's own request logs hold the URL.
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: BODY_LIMIT_BYTES,
    requestTimeout: REQUEST_TIMEOUT_MS,
    trustProxy: config.trustProxyHops > 0 ? (_address, hop) => hop < config.trustProxyHops : false,
    frameworkErrors: frameworkErrorHandler,
    clientErrorHandler,
    routerOptions: { ignoreTrailingSlash: true }
  });

  // The order sets the order of the checks on each route: IP limit, auth, then user limit. A
  // malformed path is refused before routing, so no limit sees it: it costs one fixed answer and
  // one log line, and a limit at the host or proxy must cover it.
  await registerIpLimit(server);
  registerAuth(server, { auth, observeRoute });
  await registerUserLimit(server);
  registerErrorHandlers(server);

  server.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        // The route's pattern, never the URL, whose ids and query could hold anything.
        route: request.routeOptions.url ?? "unmatched",
        status: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime)
      },
      "request"
    );
  });

  await server.register(
    async (scope) => {
      registerHealthRoutes(scope, pool);
      registerMeRoutes(scope);
      registerAuthRoutes(scope, { auth, guestLimit: guestLimit(server) });
      registerTestRoutes?.(scope);
    },
    { prefix: "/api/v1" }
  );

  return server;
}
