import { MeDtoSchema } from "@jobflow/contract";
import type { FastifyInstance } from "fastify";

export function registerMeRoutes(scope: FastifyInstance): void {
  scope.get("/me", async (request) => {
    const { userId, isAnonymous, createdAt } = request.auth;
    return MeDtoSchema.parse({ userId, isAnonymous, createdAt: createdAt.toISOString() });
  });
}
