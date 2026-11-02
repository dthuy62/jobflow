import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { registerDocsRoutes } from "./api/docs-routes.js";
import { registerApiRoutes } from "./api/register-routes.js";
import { loadRuntimeConfig, type RuntimeConfig } from "./config/runtime-config.js";
import { mapErrorToResponse } from "./errors/error-mapper.js";
import { redactSensitiveText } from "@jobflow/safety";
import type { EvaluationServiceOptions } from "./services/evaluation-service.js";

const MAX_PARAM_LENGTH = 16 * 1024;

export interface CreateServerOptions {
  readonly config?: RuntimeConfig;
  readonly registerTestRoutes?: (apiV1: FastifyInstance) => Promise<void> | void;
  /** Test seam: the SSRF guard refuses the local fixture server, so tests stub the posting fetch. */
  readonly evaluationFetchPosting?: EvaluationServiceOptions["fetchPosting"];
}

export async function createServer(options: CreateServerOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadRuntimeConfig();
  const server = Fastify({
    routerOptions: {
      ignoreTrailingSlash: true,
      // Fastify answers a longer path parameter itself, before the pairing token
      // guard, with a 414 that echoes the path. Node's 16 KiB header limit caps the
      // real length, so an overlong id reaches its route and gets the API's answers.
      maxParamLength: MAX_PARAM_LENGTH
    },
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
      : {}),
    ...(options.evaluationFetchPosting ? { evaluationFetchPosting: options.evaluationFetchPosting } : {})
  });

  return server;
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
