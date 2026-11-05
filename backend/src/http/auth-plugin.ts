import type { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from "fastify";
import { AuthUnavailableError, InvalidTokenError, type UserId, type VerifiedIdentity } from "../core/identity.js";
import type { AuthVerifier, UserRepository } from "../core/ports.js";
import { ApiError } from "./errors.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by the auth hook on every route that is not public. The only source of a user id. */
    auth: { readonly userId: UserId; readonly isAnonymous: boolean; readonly createdAt: Date };
  }
  interface FastifyContextConfig {
    /** A route is public only by saying so. */
    public?: boolean;
  }
}

export interface AuthDeps {
  readonly authVerifier: AuthVerifier;
  readonly users: UserRepository;
  readonly observeRoute?: ((route: RouteOptions) => void) | undefined;
}

const unauthorized = () => new ApiError(401, "UNAUTHORIZED", "Sign in again.");

function bearerToken(header: string | undefined): string | undefined {
  return header?.match(/^bearer ([^\s]+)$/i)?.[1];
}

/** Denies by default: every route gets the check at registration, unless it has `config.public`. */
export function registerAuth(server: FastifyInstance, { authVerifier, users, observeRoute }: AuthDeps): void {
  server.decorateRequest("auth", undefined as never);

  async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const token = bearerToken(request.headers.authorization);
      if (token === undefined) throw new InvalidTokenError();
      const identity = await authVerifier.verify(token);
      const user = await resolveUser(request, identity);
      if (user.deleted) throw new InvalidTokenError();
      request.auth = { userId: user.id, isAnonymous: identity.isAnonymous, createdAt: user.createdAt };
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        void reply.header("www-authenticate", "Bearer");
        throw unauthorized();
      }
      if (error instanceof AuthUnavailableError) {
        request.log.error({ err: error.cause }, "token check unavailable");
        throw new ApiError(503, "AUTH_UNAVAILABLE", "Sign-in could not be checked right now.");
      }
      throw error;
    }
  }

  async function resolveUser(request: FastifyRequest, { subject, isAnonymous }: VerifiedIdentity) {
    try {
      return await users.resolve(subject, isAnonymous);
    } catch (error) {
      request.log.error({ err: error }, "user lookup failed");
      throw new ApiError(503, "UNAVAILABLE", "The service is temporarily unavailable.");
    }
  }

  server.addHook("onRoute", (route) => {
    observeRoute?.(route);
    if (route.config?.public === true) return;
    const existing = route.onRequest === undefined ? [] : [route.onRequest].flat();
    route.onRequest = [...existing, authenticate];
  });
}
