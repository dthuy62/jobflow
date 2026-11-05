import { MeDtoSchema } from "@jobflow/contract";
import type { FastifyInstance, FastifyRequest } from "fastify";

export const meDto = ({ userId, isAnonymous, createdAt }: FastifyRequest["auth"]) =>
  MeDtoSchema.parse({ userId, isAnonymous, createdAt: createdAt.toISOString() });

export function registerMeRoutes(scope: FastifyInstance): void {
  scope.get("/me", async (request) => meDto(request.auth));
}
