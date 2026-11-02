import type { FastifyInstance, InjectOptions } from "fastify";
import { expect } from "vitest";
import { asUser } from "./server.js";

export interface CrossUserCase {
  readonly server: FastifyInstance;
  /** Creates a resource as this user and returns its id. */
  seed(headers: Record<string, string>): Promise<string>;
  /** The request to protect: it reads or changes that resource. */
  request(resourceId: string, headers: Record<string, string>): InjectOptions;
}

/**
 * Asserts that user B cannot read or change user A's resource, and that A can, so the check
 * cannot pass because the route fails for everyone. Use on every endpoint with user data.
 * B gets the same 404 as for an id that does not exist, which reveals nothing.
 */
export async function expectCrossUserDenied({ server, seed, request }: CrossUserCase): Promise<void> {
  const owner = asUser("cross-user-owner");
  const other = asUser("cross-user-other");
  const resourceId = await seed(owner);

  const denied = await server.inject(request(resourceId, other));
  expect(denied.statusCode, "another user must get 404").toBe(404);
  expect(denied.json().error.code).toBe("NOT_FOUND");
  expect(denied.body).not.toContain(resourceId);

  const allowed = await server.inject(request(resourceId, owner));
  expect(allowed.statusCode, "the owner must still reach it").toBeLessThan(300);
}
