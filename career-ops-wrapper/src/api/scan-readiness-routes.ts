import type { FastifyInstance } from "fastify";
import { ScanReadinessDtoSchema } from "../contracts/index.js";
import type { ScanReadinessService } from "../services/scan-readiness-service.js";

export async function registerScanReadinessRoutes(
  server: FastifyInstance,
  scanReadinessService: ScanReadinessService
): Promise<void> {
  server.get("/scan-readiness", async () => {
    return ScanReadinessDtoSchema.parse(await scanReadinessService.getScanReadiness());
  });
}
