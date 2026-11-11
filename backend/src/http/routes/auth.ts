import {
  GuestResponseDtoSchema,
  LogoutRequestSchema,
  RefreshRequestSchema,
  SessionTokensDtoSchema,
  SsoRequestSchema,
  SsoResponseDtoSchema
} from "@jobflow/contract";
import type { FastifyInstance, FastifyRequest, onRequestAsyncHookHandler } from "fastify";
import type { AuthService } from "../../core/auth-service.js";
import { AuthUnavailableError, InvalidTokenError, SignInRequiredError } from "../../core/identity.js";
import { ApiError, parseRequest } from "../errors.js";
import { meDto } from "./me.js";

export interface AuthRouteDeps {
  readonly auth: AuthService;
  /** Runs before a guest is created, on top of the IP limit. */
  readonly guestLimit: onRequestAsyncHookHandler;
}

/** Turns the service's errors into the contract's. Anything unknown is a database failure: these calls are safe to retry. */
async function answer<Result>(request: FastifyRequest, work: () => Promise<Result>): Promise<Result> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof InvalidTokenError) {
      // The client gets no reason: telling a forger which check failed would help them.
      request.log.info({ reason: error.reason }, "token refused");
      throw new ApiError(401, "UNAUTHORIZED", "Sign in again.");
    }
    if (error instanceof SignInRequiredError) throw new ApiError(403, "SIGN_IN_REQUIRED", "Sign in with Google to use this.");
    if (error instanceof AuthUnavailableError) {
      request.log.error({ err: error.cause }, "id token check unavailable");
      throw new ApiError(503, "AUTH_UNAVAILABLE", "Sign-in could not be checked right now.");
    }
    if (error instanceof ApiError) throw error;
    request.log.error({ err: error }, "auth call failed");
    throw new ApiError(503, "UNAVAILABLE", "The service is temporarily unavailable.");
  }
}

export function registerAuthRoutes(scope: FastifyInstance, { auth, guestLimit }: AuthRouteDeps): void {
  scope.post("/auth/guest", { config: { public: true }, onRequest: guestLimit }, async (request) => {
    const { tokens, account } = await answer(request, () => auth.startGuest());
    return GuestResponseDtoSchema.parse({ tokens, account: meDto(account) });
  });

  scope.post("/auth/sso", { config: { public: true } }, async (request) => {
    const { idToken, guestRefreshToken } = parseRequest(SsoRequestSchema, request.body);
    const { tokens, account, guestMerged } = await answer(request, () => auth.signIn(idToken, guestRefreshToken));
    return SsoResponseDtoSchema.parse({ tokens, account: meDto(account), guestMerged });
  });

  scope.post("/auth/refresh", { config: { public: true } }, async (request) => {
    const { refreshToken } = parseRequest(RefreshRequestSchema, request.body);
    return SessionTokensDtoSchema.parse(await answer(request, () => auth.refresh(refreshToken)));
  });

  scope.post("/auth/logout", async (request, reply) => {
    const { installationId } = parseRequest(LogoutRequestSchema, request.body);
    await answer(request, () => auth.logout(request.auth, installationId));
    return reply.status(204).send();
  });
}
