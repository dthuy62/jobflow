import type { FastifyInstance } from "fastify";
import { PortalDtoSchema } from "../contracts/index.js";
import type { PortalService } from "../services/portal-service.js";

export async function registerPortalRoutes(
  server: FastifyInstance,
  portalService: PortalService
): Promise<void> {
  server.get("/portals", async () => {
    return PortalDtoSchema.parse(await portalService.getPortals());
  });
}
