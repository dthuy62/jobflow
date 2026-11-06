import rateLimit, { type errorResponseBuilderContext } from "@fastify/rate-limit";
import type { FastifyInstance, FastifyRequest, onRequestAsyncHookHandler } from "fastify";
import { ApiError } from "./errors.js";

export const IP_LIMIT_PER_MINUTE = 300;
export const USER_LIMIT_PER_MINUTE = 120;
/** Loose enough for many phones behind one carrier address. */
export const GUEST_LIMIT_PER_MINUTE = 10;
const WINDOW_MS = 60_000;
/** Addresses and users tracked at once, which bounds the memory an attacker can use. */
const TRACKED_KEYS = 50_000;

function limitReached(_request: FastifyRequest, context: Pick<errorResponseBuilderContext, "ttl">): Error {
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
    // No keyGenerator: the default reads `request.ip`, which honours TRUST_PROXY, and groups
    // IPv6 by /64, because one client commonly holds a whole /64.
    errorResponseBuilder: limitReached
  });
  // Routes get this limit from the plugin. This covers requests that match no route, which would
  // otherwise be parsed before anything counts them. The plugin counts a request only once.
  server.addHook("onRequest", server.rateLimit());
}

/** Runs after auth and before the body is parsed, so bad bodies count too. Skips public routes, which have no user. */
export async function registerUserLimit(server: FastifyInstance): Promise<void> {
  await server.register(rateLimit, {
    global: true,
    hook: "preParsing",
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

/**
 * Its own counter per address, for creating guests. The IP limit's hook has already run on the
 * request, and the plugin's route hooks run once per request, so this counts on its own.
 * Call after `registerIpLimit`.
 */
export function guestLimit(server: FastifyInstance): onRequestAsyncHookHandler {
  const check = server.createRateLimit({ max: GUEST_LIMIT_PER_MINUTE, timeWindow: WINDOW_MS });
  return async (request) => {
    const result = await check(request);
    if (!result.isAllowed && result.isExceeded) throw limitReached(request, result);
  };
}
