import { Writable } from "node:stream";
import type { FastifyInstance } from "fastify";
import type { Config } from "../../src/config.js";
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

export interface TestServer {
  readonly server: FastifyInstance;
  /** Everything logged so far, as text. */
  logs(): string;
  /** Everything logged so far, parsed. */
  logLines(): Record<string, unknown>[];
}

export async function createTestServer(overrides: Partial<ServerDeps> = {}): Promise<TestServer> {
  const chunks: string[] = [];
  const logStream = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(String(chunk));
      done();
    }
  });
  const server = await createServer({ config: testConfig, pool: healthyPool, logStream, ...overrides });
  await server.ready();
  return {
    server,
    logs: () => chunks.join(""),
    logLines: () => chunks.join("").split("\n").filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>)
  };
}
