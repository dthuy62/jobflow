import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { RuntimeConfig } from "../config/runtime-config.js";
import { ApiError } from "../errors/api-error.js";

const LOCALHOST_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function isPairingTokenRequiredForHost(host: string): boolean {
  return !LOCALHOST_HOSTS.has(host.toLowerCase());
}

export function registerLocalPairingTokenGuard(
  server: FastifyInstance,
  config: RuntimeConfig
): void {
  server.addHook("onRequest", async (request) => {
    if (!isProtectedApiV1Route(request) || !isPairingTokenRequiredForHost(config.host)) {
      return;
    }

    const suppliedToken = readPairingTokenHeader(request);

    if (!config.pairingToken || !suppliedToken || !tokensMatch(config.pairingToken, suppliedToken)) {
      throw new ApiError("UNAUTHORIZED", "A valid local pairing token is required.");
    }
  });
}

function isProtectedApiV1Route(request: FastifyRequest): boolean {
  const pathname = new URL(request.url, "http://local").pathname;
  return !(request.method === "GET" && (pathname === "/health" || pathname === "/api/v1/health"));
}

function readPairingTokenHeader(request: FastifyRequest): string | undefined {
  const headerValue = request.headers["x-career-ops-token"];

  if (Array.isArray(headerValue)) {
    return undefined;
  }

  if (headerValue?.includes(",")) {
    return undefined;
  }

  return headerValue;
}

function tokensMatch(expected: string, supplied: string): boolean {
  const expectedBuffer = hashToken(expected);
  const suppliedBuffer = hashToken(supplied);

  return timingSafeEqual(expectedBuffer, suppliedBuffer);
}

function hashToken(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
