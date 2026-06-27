import type { FastifyInstance } from "fastify";
import { registerCvRoutes } from "./cv-routes.js";
import { registerHealthRoutes } from "./health-routes.js";
import { registerPortalRoutes } from "./portal-routes.js";
import { registerProfileRoutes } from "./profile-routes.js";
import { registerScanReadinessRoutes } from "./scan-readiness-routes.js";
import type { RuntimeConfig } from "../config/runtime-config.js";
import { registerLocalPairingTokenGuard } from "../security/local-pairing-token.js";
import { createCvService } from "../services/cv-service.js";
import { createHealthService } from "../services/health-service.js";
import { createPortalService } from "../services/portal-service.js";
import { createProfileService } from "../services/profile-service.js";
import { createScanReadinessService } from "../services/scan-readiness-service.js";

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
      await registerCvRoutes(apiV1, createCvService(options.config));
      await registerProfileRoutes(apiV1, createProfileService(options.config));
      await registerPortalRoutes(apiV1, createPortalService(options.config));
      await registerScanReadinessRoutes(apiV1, createScanReadinessService(options.config));
      await options.registerAdditionalRoutes?.(apiV1);
    },
    { prefix: "/api/v1" }
  );
}
