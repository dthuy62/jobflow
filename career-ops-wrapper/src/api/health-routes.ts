import type { FastifyInstance } from "fastify";
import { HealthDtoSchema } from "../contracts/index.js";
import type { HealthService } from "../services/health-service.js";

export async function registerHealthRoutes(
  server: FastifyInstance,
  healthService: HealthService
): Promise<void> {
  server.get("/health", async () => {
    return HealthDtoSchema.parse(await healthService.getHealth());
  });
}
