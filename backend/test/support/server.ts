import { Writable } from "node:stream";
import type { FastifyInstance, RouteOptions } from "fastify";
import type { Config } from "../../src/config.js";
import { InvalidTokenError, type UserId } from "../../src/core/identity.js";
import type { AuthVerifier, DeviceRepository, UserRepository } from "../../src/core/ports.js";
import { createServer, type ServerDeps } from "../../src/server.js";

export const testConfig: Config = {
  env: "test",
  host: "127.0.0.1",
  port: 0,
  databaseUrl: "postgres://jobflow_app:dev-only-app@127.0.0.1:5432/unused",
  firebaseProjectId: "demo-jobflow",
  trustProxyHops: 0
};

export const healthyPool: ServerDeps["pool"] = { query: (async () => ({ rows: [] })) as never };

/** A token this stub accepts: `test-<subject>`, or `test-anon-<subject>` for an anonymous user. */
export const stubAuthVerifier: AuthVerifier = {
  async verify(token) {
    if (!token.startsWith("test-")) throw new InvalidTokenError();
    return { subject: token, isAnonymous: token.startsWith("test-anon-") };
  }
};

export function createMemoryUsers(): UserRepository & { readonly deletedSubjects: Set<string> } {
  const created = new Map<string, { id: UserId; createdAt: Date }>();
  const deletedSubjects = new Set<string>();
  return {
    deletedSubjects,
    async resolve(subject) {
      let user = created.get(subject);
      if (!user) {
        user = { id: `user-${created.size + 1}` as UserId, createdAt: new Date("2026-11-02T00:00:00.000Z") };
        created.set(subject, user);
      }
      return { ...user, deleted: deletedSubjects.has(subject) };
    },
    markLinked: async () => undefined,
    mergeGuest: async () => false
  };
}

export const memoryDevices: DeviceRepository = { remove: async () => undefined };

export const asUser = (subject = "user-a") => ({ authorization: `Bearer test-${subject}` });

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
    authVerifier: stubAuthVerifier,
    users: createMemoryUsers(),
    devices: memoryDevices,
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
