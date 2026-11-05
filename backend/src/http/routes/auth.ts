import { LogoutRequestSchema, SsoRequestSchema, SsoResponseDtoSchema } from "@jobflow/contract";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { AuthUnavailableError, InvalidTokenError, type VerifiedIdentity } from "../../core/identity.js";
import type { AuthVerifier, DeviceRepository, UserRepository } from "../../core/ports.js";
import { ApiError, parseRequest } from "../errors.js";
import { meDto } from "./me.js";

export interface AuthRouteDeps {
  readonly authVerifier: AuthVerifier;
  readonly users: UserRepository;
  readonly devices: DeviceRepository;
}

/**
 * The guest whose data this token may move, or undefined when it may not. An outage is not an
 * answer: reporting "no merge" would make the app give up on data a retry could still bring.
 */
async function verifyGuest(request: FastifyRequest, authVerifier: AuthVerifier, token: string): Promise<VerifiedIdentity | undefined> {
  try {
    const identity = await authVerifier.verify(token);
    return identity.isAnonymous ? identity : undefined;
  } catch (error) {
    if (error instanceof InvalidTokenError) return undefined;
    if (error instanceof AuthUnavailableError) {
      request.log.error({ err: error.cause }, "guest token check unavailable");
      throw new ApiError(503, "AUTH_UNAVAILABLE", "Sign-in could not be checked right now.");
    }
    throw error;
  }
}

/** These calls are safe to retry, so a database failure gets the contract's retryable answer. */
async function orUnavailable<Result>(request: FastifyRequest, work: () => Promise<Result>): Promise<Result> {
  try {
    return await work();
  } catch (error) {
    request.log.error({ err: error }, "auth write failed");
    throw new ApiError(503, "UNAVAILABLE", "The service is temporarily unavailable.");
  }
}

export function registerAuthRoutes(scope: FastifyInstance, { authVerifier, users, devices }: AuthRouteDeps): void {
  // The auth hook has already created the user. Limits on guests belong here when they come.
  scope.post("/auth/guest", async (request) => {
    if (!request.auth.isAnonymous) throw new ApiError(409, "CONFLICT", "This user is already signed in.");
    return meDto(request.auth);
  });

  scope.post("/auth/sso", async (request) => {
    const { auth } = request;
    if (auth.isAnonymous) throw new ApiError(403, "SIGN_IN_REQUIRED", "Sign in with Google to use this.");
    const { guestToken } = parseRequest(SsoRequestSchema, request.body);
    const guest = guestToken === undefined ? undefined : await verifyGuest(request, authVerifier, guestToken);
    const guestMerged = await orUnavailable(request, async () => {
      await users.markLinked(auth.userId);
      return guest !== undefined && (await users.mergeGuest(guest.subject, auth.userId));
    });
    return SsoResponseDtoSchema.parse({ account: meDto(auth), guestMerged });
  });

  // No token is revoked: Firebase can only revoke them all, which would sign out every other device.
  scope.post("/auth/logout", async (request, reply) => {
    const { installationId } = parseRequest(LogoutRequestSchema, request.body);
    await orUnavailable(request, () => devices.remove(request.auth.userId, installationId));
    return reply.status(204).send();
  });
}
