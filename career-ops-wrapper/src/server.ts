import { fileURLToPath } from "node:url";
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { registerDocsRoutes } from "./api/docs-routes.js";
import { registerApiRoutes } from "./api/register-routes.js";
import { loadRuntimeConfig, type RuntimeConfig } from "./config/runtime-config.js";
import { ApiError } from "./errors/api-error.js";
import { mapErrorToResponse } from "./errors/error-mapper.js";
import { assertPairingToken } from "./security/local-pairing-token.js";
import { redactSensitiveText } from "./security/redaction.js";

export interface CreateServerOptions {
  readonly config?: RuntimeConfig;
  readonly registerTestRoutes?: (apiV1: FastifyInstance) => Promise<void> | void;
}

export async function createServer(options: CreateServerOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadRuntimeConfig();
  const server = Fastify({
    routerOptions: {
      ignoreTrailingSlash: true
    },
    frameworkErrors: (error, request, reply) => answerBadUrl(error, request, reply, config),
    logger: false
  });

  server.setErrorHandler((error, _request, reply) => {
    const response = mapErrorToResponse(error);
    reply.status(response.statusCode).send(response.body);
  });

  await registerDocsRoutes(server);

  await registerApiRoutes(server, {
    config,
    ...(options.registerTestRoutes
      ? { registerAdditionalRoutes: options.registerTestRoutes }
      : {})
  });

  return server;
}

/**
 * Malformed percent-encoding (FST_ERR_BAD_URL) fails before routing, so /api/v1
 * hooks and its not-found handler never run. Answer like an unknown /api/v1
 * path: token check first, then the NOT_FOUND envelope. This early context
 * does not use the server error handler, so the error is mapped here.
 */
function answerBadUrl(error: FastifyError, request: FastifyRequest, reply: FastifyReply, config: RuntimeConfig): void {
  if (!new URL(request.url, "http://local").pathname.startsWith("/api/v1/")) {
    void reply.code(400).send({ error: "Bad Request", code: error.code, message: error.message, statusCode: 400 });
    return;
  }

  let apiError: unknown = new ApiError("NOT_FOUND", "Resource was not found.");
  try {
    assertPairingToken(request, config);
  } catch (tokenError) {
    apiError = tokenError;
  }
  const response = mapErrorToResponse(apiError);
  void reply.code(response.statusCode).send(response.body);
}

async function main(): Promise<void> {
  let workspacePath: string | undefined;

  try {
    const config = loadRuntimeConfig();
    workspacePath = config.workspace;
    const server = await createServer({ config });

    await server.listen({
      host: config.host,
      port: config.port
    });

    // Close cleanly so a running scan's process group is terminated, not orphaned.
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.once(signal, () => {
        void server.close().finally(() => process.exit(0));
      });
    }
  } catch (error) {
    logStartupError(error, workspacePath);
    process.exitCode = 1;
  }
}

export function logStartupError(error: unknown, workspacePath?: string): void {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(redactSensitiveText(message, { ...(workspacePath ? { workspacePath } : {}) }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}
