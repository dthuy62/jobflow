import type { FastifyInstance } from "fastify";
import { registerArtifactRoutes } from "./artifact-routes.js";
import { registerCvRoutes } from "./cv-routes.js";
import { registerHealthRoutes } from "./health-routes.js";
import { registerOfferRoutes } from "./offer-routes.js";
import { registerPortalRoutes } from "./portal-routes.js";
import { registerProfileRoutes } from "./profile-routes.js";
import { registerReportRoutes } from "./report-routes.js";
import { registerScanReadinessRoutes } from "./scan-readiness-routes.js";
import { registerScanRunRoutes } from "./scan-run-routes.js";
import type { RuntimeConfig } from "../config/runtime-config.js";
import { ApiError } from "../errors/api-error.js";
import { registerLocalPairingTokenGuard } from "../security/local-pairing-token.js";
import { createArtifactService } from "../services/artifact-service.js";
import { createCvService } from "../services/cv-service.js";
import { createHealthService } from "../services/health-service.js";
import { createOfferService } from "../services/offer-service.js";
import { createPortalService } from "../services/portal-service.js";
import { createProfileService } from "../services/profile-service.js";
import { createReportService } from "../services/report-service.js";
import { createScanReadinessService } from "../services/scan-readiness-service.js";
import { createScanRunService } from "../services/scan-run-service.js";

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
      // Also answers an {id} over Fastify's 100-character path parameter limit,
      // which never reaches its route, with the error envelope.
      apiV1.setNotFoundHandler(async () => {
        throw new ApiError("NOT_FOUND", "Resource was not found.");
      });
      await registerHealthRoutes(apiV1, createHealthService(options.config));
      await registerCvRoutes(apiV1, createCvService(options.config));
      await registerProfileRoutes(apiV1, createProfileService(options.config));
      await registerPortalRoutes(apiV1, createPortalService(options.config));
      await registerScanReadinessRoutes(apiV1, createScanReadinessService(options.config));
      const scanRunService = createScanRunService(options.config);
      apiV1.addHook("onClose", async () => scanRunService.shutdown());
      await registerScanRunRoutes(apiV1, scanRunService);
      await registerOfferRoutes(apiV1, createOfferService(options.config));
      await registerReportRoutes(apiV1, createReportService(options.config));
      await registerArtifactRoutes(apiV1, createArtifactService(options.config));
      await options.registerAdditionalRoutes?.(apiV1);
    },
    { prefix: "/api/v1" }
  );
}
