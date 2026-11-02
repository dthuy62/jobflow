import rateLimit, { type errorResponseBuilderContext } from "@fastify/rate-limit";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ApiError } from "./errors.js";

export const IP_LIMIT_PER_MINUTE = 300;
export const USER_LIMIT_PER_MINUTE = 120;
const WINDOW_MS = 60_000;
/** Addresses and users tracked at once, which bounds the memory an attacker can use. */
const TRACKED_KEYS = 50_000;

function limitReached(_request: FastifyRequest, context: errorResponseBuilderContext): Error {
  const error = new ApiError(429, "RATE_LIMITED", "Too many requests. Try again soon.", {
    retryAfterSeconds: Math.max(1, Math.ceil(context.ttl / 1000))
  });
  return Object.assign(error, { statusCode: 429 });
}

/**
 * Limits are in memory, so several instances multiply them. A shared store comes when a second
 * instance does. Must run before routes are added, and before auth, so the IP limit sees
 * requests with no valid token.
 */
export async function registerIpLimit(server: FastifyInstance): Promise<void> {
  await server.register(rateLimit, {
    global: true,
    hook: "onRequest",
    nameSpace: "ip-",
    max: IP_LIMIT_PER_MINUTE,
    timeWindow: WINDOW_MS,
    cache: TRACKED_KEYS,
    // Honours TRUST_PROXY, and never reads a forwarding header itself.
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: limitReached
  });
}

/** Runs after auth, and skips public routes, which have no user. */
export async function registerUserLimit(server: FastifyInstance): Promise<void> {
  await server.register(rateLimit, {
    global: true,
    hook: "preHandler",
    nameSpace: "user-",
    max: USER_LIMIT_PER_MINUTE,
    timeWindow: WINDOW_MS,
    cache: TRACKED_KEYS,
    allowList: (request) => request.auth === undefined,
    // Runs before allowList, so it also sees public routes.
    keyGenerator: (request) => request.auth?.userId ?? "public",
    errorResponseBuilder: limitReached
  });
}
