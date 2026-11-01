import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import { registerDocsRoutes } from "./api/docs-routes.js";
import { registerApiRoutes } from "./api/register-routes.js";
import { loadRuntimeConfig, type RuntimeConfig } from "./config/runtime-config.js";
import { mapErrorToResponse } from "./errors/error-mapper.js";
import { redactSensitiveText } from "./security/redaction.js";
import type { EvaluationServiceOptions } from "./services/evaluation-service.js";

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
      ignoreTrailingSlash: true
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
