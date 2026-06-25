import type { FastifyInstance } from "fastify";
import { ProfileDtoSchema } from "../contracts/index.js";
import type { ProfileService } from "../services/profile-service.js";

export async function registerProfileRoutes(
  server: FastifyInstance,
  profileService: ProfileService
): Promise<void> {
  server.get("/profile", async () => {
    return ProfileDtoSchema.parse(await profileService.getProfile());
  });
}
