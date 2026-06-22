import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health-routes.js";
import type { RuntimeConfig } from "../config/runtime-config.js";
import { registerLocalPairingTokenGuard } from "../security/local-pairing-token.js";
import { createHealthService } from "../services/health-service.js";

export interface RegisterApiRoutesOptions {
  readonly config: RuntimeConfig;
  readonly registerAdditionalRoutes?: (apiV1: FastifyInstance) => Promise<void> | void;
}

export async function registerApiRoutes(
  server: FastifyInstance,
  options: RegisterApiRoutesOptions
): Promise<void> {
  await server.register(
    async (apiV1) => {
      registerLocalPairingTokenGuard(apiV1, options.config);
      await registerHealthRoutes(apiV1, createHealthService(options.config));
      await options.registerAdditionalRoutes?.(apiV1);
    },
    { prefix: "/api/v1" }
  );
}
