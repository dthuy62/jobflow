import type { FastifyInstance, FastifyReply, FastifyRequest, RouteOptions } from "fastify";
import type { AuthService } from "../core/auth-service.js";
import { type AuthenticatedUser, InvalidTokenError } from "../core/identity.js";
import { ApiError } from "./errors.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Set by the auth hook on every route that is not public. The only source of a user id. */
    auth: AuthenticatedUser;
  }
  interface FastifyContextConfig {
    /** A route is public only by saying so. */
    public?: boolean;
  }
}

export interface AuthDeps {
  readonly auth: Pick<AuthService, "authenticate">;
  readonly observeRoute?: ((route: RouteOptions) => void) | undefined;
}

function bearerToken(header: string | undefined): string | undefined {
  return header?.match(/^bearer ([^\s]+)$/i)?.[1];
}

/** Denies by default: every route gets the check at registration, unless it has `config.public`. */
export function registerAuth(server: FastifyInstance, { auth, observeRoute }: AuthDeps): void {
  server.decorateRequest("auth", undefined as never);

  async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const token = bearerToken(request.headers.authorization);
      if (token === undefined) throw new InvalidTokenError();
      request.auth = await auth.authenticate(token);
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        void reply.header("www-authenticate", "Bearer");
        throw new ApiError(401, "UNAUTHORIZED", "Sign in again.");
      }
      // The token checks are local, so this is the session lookup: the app retries and keeps its session.
      request.log.error({ err: error }, "session lookup failed");
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
