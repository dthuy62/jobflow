import { MeDtoSchema } from "@jobflow/contract";
import type { FastifyInstance } from "fastify";
import type { Account } from "../../core/identity.js";

export const meDto = ({ userId, isAnonymous, createdAt }: Account) => MeDtoSchema.parse({ userId, isAnonymous, createdAt: createdAt.toISOString() });

export function registerMeRoutes(scope: FastifyInstance): void {
  scope.get("/me", async (request) => meDto(request.auth));
}
