import type { FastifyInstance } from "fastify";
import {
  PORTAL_CONFIG_MAX_BYTES,
  PortalDtoSchema,
  type SavePortalRequestDto
} from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import type { PortalService } from "../services/portal-service.js";

export async function registerPortalRoutes(
  server: FastifyInstance,
  portalService: PortalService
): Promise<void> {
  server.get("/portals", async () => {
    return PortalDtoSchema.parse(await portalService.getPortals());
  });

  server.put(
    "/portals",
    { bodyLimit: PORTAL_CONFIG_MAX_BYTES },
    async (request) => {
      return PortalDtoSchema.parse(
        await portalService.savePortals(parseSavePortalRequestBody(request.body))
      );
    }
  );
}

function parseSavePortalRequestBody(body: unknown): SavePortalRequestDto {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError("VALIDATION_ERROR", "Portal config request is invalid.");
  }

  return body as SavePortalRequestDto;
}
