import type { Writable } from "node:stream";
import Fastify, { type FastifyInstance } from "fastify";
import type { Pool } from "pg";
import type { Config } from "./config.js";
import { frameworkErrorHandler, registerErrorHandlers } from "./http/error-handler.js";
import { registerHealthRoutes } from "./http/routes/health.js";
import { serializeError } from "./logging.js";

const BODY_LIMIT_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

export interface ServerDeps {
  readonly config: Config;
  readonly pool: Pick<Pool, "query">;
  /** Where logs go. Defaults to stdout; tests read them from here. */
  readonly logStream?: Writable;
  readonly registerTestRoutes?: (scope: FastifyInstance) => void;
}

export async function createServer(deps: ServerDeps): Promise<FastifyInstance> {
  const { config, pool, logStream, registerTestRoutes } = deps;
  const server = Fastify({
    logger: {
      level: config.env === "test" && !logStream ? "silent" : "info",
      base: null,
      serializers: { err: serializeError },
      ...(logStream ? { stream: logStream } : {})
    },
    // The onResponse hook below logs an allowlist instead: Fastify's own request logs hold the URL.
    disableRequestLogging: true,
    bodyLimit: BODY_LIMIT_BYTES,
    requestTimeout: REQUEST_TIMEOUT_MS,
    trustProxy: config.trustProxyHops > 0 ? (_address, hop) => hop < config.trustProxyHops : false,
    frameworkErrors: frameworkErrorHandler,
    routerOptions: { ignoreTrailingSlash: true }
  });

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
      registerTestRoutes?.(scope);
    },
    { prefix: "/api/v1" }
  );

  return server;
}
