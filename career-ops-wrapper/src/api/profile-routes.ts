import type { FastifyInstance } from "fastify";
import {
  PROFILE_CONFIG_MAX_BYTES,
  ProfileDtoSchema,
  type SaveProfileRequestDto
} from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import type { ProfileService } from "../services/profile-service.js";

export async function registerProfileRoutes(
  server: FastifyInstance,
  profileService: ProfileService
): Promise<void> {
  server.get("/profile", async () => {
    return ProfileDtoSchema.parse(await profileService.getProfile());
  });

  server.put(
    "/profile",
    { bodyLimit: PROFILE_CONFIG_MAX_BYTES },
    async (request) => {
      return ProfileDtoSchema.parse(
        await profileService.saveProfile(parseSaveProfileRequestBody(request.body))
      );
    }
  );
}

function parseSaveProfileRequestBody(body: unknown): SaveProfileRequestDto {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError("VALIDATION_ERROR", "Profile config request is invalid.");
  }

  return body as SaveProfileRequestDto;
}
