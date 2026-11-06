import { Writable } from "node:stream";
import type { FastifyInstance, RouteOptions } from "fastify";
import type { Pool } from "pg";
import { createJwtAccessTokens } from "../../src/adapters/jwt-access-tokens.js";
import { createPgDeviceRepository } from "../../src/adapters/pg-device-repository.js";
import { createPgSessionRepository } from "../../src/adapters/pg-session-repository.js";
import { createPgUserRepository, GUEST_MERGE_STEPS, type GuestMergeStep } from "../../src/adapters/pg-user-repository.js";
import type { Config } from "../../src/config.js";
import { createAuthService, type AuthService } from "../../src/core/auth-service.js";
import { AuthUnavailableError, InvalidTokenError, type SessionId, type UserId } from "../../src/core/identity.js";
import type { IdentityVerifier } from "../../src/core/ports.js";
import { createServer, type ServerDeps } from "../../src/server.js";

export const testConfig: Config = {
  env: "test",
  host: "127.0.0.1",
  port: 0,
  databaseUrl: "postgres://jobflow_app:dev-only-app@127.0.0.1:5432/unused",
  firebaseProjectId: "demo-jobflow",
  jwtSigningKeys: [{ kid: "test-1", secret: "dev-only-test-signing-key-0123456789abcdef" }],
  trustProxyHops: 0
};

export const healthyPool: ServerDeps["pool"] = { query: (async () => ({ rows: [] })) as never };

const notInStub = async (): Promise<never> => {
  throw new Error("Not in this stub: use the real auth service.");
};

/**
 * For tests of everything but auth itself. Accepts the access token `test-<subject>` for a member
 * and `test-anon-<subject>` for a guest, each with a stable id.
 */
export function createStubAuth(): AuthService {
  const ids = new Map<string, UserId>();
  return {
    async authenticate(token) {
      if (!token.startsWith("test-")) throw new InvalidTokenError();
      let userId = ids.get(token);
      if (!userId) {
        userId = `user-${ids.size + 1}` as UserId;
        ids.set(token, userId);
      }
      return { userId, sessionId: `session-${userId}` as SessionId, isAnonymous: token.startsWith("test-anon-"), createdAt: new Date("2026-11-02T00:00:00.000Z") };
    },
    startGuest: notInStub,
    signIn: notInStub,
    refresh: notInStub,
    logout: notInStub
  };
}

export const asUser = (subject = "user-a") => ({ authorization: `Bearer test-${subject}` });

/**
 * An ID token stub: `id-<subject>` signs in a member, `id-anon-<subject>` is an anonymous Firebase
 * user, `id-outage` cannot be checked, and anything else is invalid.
 */
export const stubIdentities: IdentityVerifier = {
  async verify(idToken) {
    if (idToken === "id-outage") throw new AuthUnavailableError(new Error("keys are down"));
    if (!idToken.startsWith("id-")) throw new InvalidTokenError();
    return { subject: idToken.slice("id-".length), isAnonymous: idToken.startsWith("id-anon-") };
  }
};

/** The real auth service on PostgreSQL, with only the identity provider stubbed. */
export function createRealAuth(
  pool: Pick<Pool, "query" | "connect">,
  { identities = stubIdentities, steps = GUEST_MERGE_STEPS }: { identities?: IdentityVerifier; steps?: readonly GuestMergeStep[] } = {}
): AuthService {
  return createAuthService({
    identities,
    accessTokens: createJwtAccessTokens(testConfig.jwtSigningKeys),
    sessions: createPgSessionRepository(pool),
    users: createPgUserRepository(pool, steps),
    devices: createPgDeviceRepository(pool)
  });
}

export interface TestServer {
  readonly server: FastifyInstance;
  readonly routes: readonly RouteOptions[];
  /** Everything logged so far, as text. */
  logs(): string;
  /** Everything logged so far, parsed. */
  logLines(): Record<string, unknown>[];
}

export async function createTestServer(overrides: Partial<ServerDeps> = {}): Promise<TestServer> {
  const chunks: string[] = [];
  const routes: RouteOptions[] = [];
  const logStream = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(String(chunk));
      done();
    }
  });
  const server = await createServer({
    config: testConfig,
    pool: healthyPool,
    auth: createStubAuth(),
    logStream,
    observeRoute: (route) => routes.push(route),
    ...overrides
  });
  await server.ready();
  return {
    server,
    routes,
    logs: () => chunks.join(""),
    logLines: () => chunks.join("").split("\n").filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>)
  };
}
