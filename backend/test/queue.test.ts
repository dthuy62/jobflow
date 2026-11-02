import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createPgBossQueue, installJobs, type PgBossQueue } from "../src/adapters/pg-boss-queue.js";
import { ALL_JOBS, systemHeartbeat, type JobDefinition } from "../src/core/jobs.js";
import { migrateUp } from "../src/db/migrate.js";
import { withTestDatabase, type TestDatabase } from "./support/database.js";

const PayloadSchema = z.strictObject({ value: z.string() });
/** Fast retries, so a test need not wait for the real backoff. */
const job = (name: string): JobDefinition<{ value: string }> => ({ name, schema: PayloadSchema, retry: { limit: 3, delaySeconds: 1, backoff: false } });

const received = job("test.received");
const retried = job("test.retried");
const invalid = job("test.invalid");
const idempotent = job("test.idempotent");
const slow = job("test.slow");
const failing = job("test.failing");
const mismatched = job("test.mismatched");
const TEST_JOBS = [received, retried, invalid, idempotent, slow, failing, mismatched];

describe("the queue, with real PostgreSQL and the app role", () => {
  let database: TestDatabase;
  let queue: PgBossQueue;
  const logged: unknown[] = [];
  const logger = {
    info: (...args: unknown[]) => void logged.push(args),
    error: (...args: unknown[]) => void logged.push(args)
  };

  beforeAll(async () => {
    database = await withTestDatabase();
    await migrateUp(database.ownerUrl);
    await installJobs(database.ownerUrl, TEST_JOBS);
  });
  afterAll(async () => {
    await database.drop();
  });
  beforeEach(async () => {
    logged.length = 0;
    queue = await createPgBossQueue(database.appUrl, { logger, role: "worker" });
  });
  afterEach(async () => {
    await queue.stop();
  });

  const eventually = (check: () => void, timeout = 15_000) => vi.waitFor(check, { timeout, interval: 100 });

  it("a registered handler receives an enqueued payload", async () => {
    const seen: unknown[] = [];
    await queue.register(received, async (payload) => {
      seen.push(payload);
    });
    await queue.enqueue(received, { value: "hello" });
    await eventually(() => expect(seen).toEqual([{ value: "hello" }]));
  });

  it("a failing handler is retried and then succeeds", async () => {
    let attempts = 0;
    let done = false;
    await queue.register(retried, async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("first attempt fails");
      done = true;
    });
    await queue.enqueue(retried, { value: "again" });
    await eventually(() => expect(done).toBe(true), 25_000);
    expect(attempts).toBe(2);
  }, 30_000);

  it("a payload that fails its schema is not enqueued", async () => {
    await expect(queue.enqueue(invalid, { value: 1 } as never)).rejects.toBeInstanceOf(z.ZodError);
    const seen: unknown[] = [];
    await queue.register(invalid, async (payload) => {
      seen.push(payload);
    });
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    expect(seen).toEqual([]);
  });

  it("the same idempotencyKey enqueues once", async () => {
    await queue.enqueue(idempotent, { value: "a" }, { idempotencyKey: "same-key" });
    await queue.enqueue(idempotent, { value: "b" }, { idempotencyKey: "same-key" });
    await queue.enqueue(idempotent, { value: "c" }, { idempotencyKey: "other-key" });
    const seen: string[] = [];
    await queue.register(idempotent, async ({ value }) => {
      seen.push(value);
    });
    await eventually(() => expect(seen.sort()).toEqual(["a", "c"]));
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    expect(seen).toEqual(["a", "c"]);
  });

  it("stop waits for a running handler to finish", async () => {
    let started = false;
    let finished = false;
    await queue.register(slow, async () => {
      started = true;
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      finished = true;
    });
    await queue.enqueue(slow, { value: "x" });
    await eventually(() => expect(started).toBe(true));
    await queue.stop();
    expect(finished).toBe(true);
  });

  it("job payloads do not appear in logs, even when a handler fails", async () => {
    let attempted = false;
    await queue.register(failing, async () => {
      attempted = true;
      throw new Error("handler failed");
    });
    await queue.enqueue(failing, { value: "s3cret-cv-text" });
    await eventually(() => expect(attempted).toBe(true));
    await eventually(() => expect(logged.length).toBeGreaterThan(0));
    expect(JSON.stringify(logged)).not.toContain("s3cret");
    expect(JSON.stringify(logged)).toContain("test.failing");
    expect(JSON.stringify(logged)).toContain("handler failed");
  });

  it("a stored payload that no longer fits its schema fails the job, and the handler never sees it", async () => {
    const writer = await createPgBossQueue(database.appUrl, { logger, role: "client" });
    await writer.enqueue(mismatched, { value: "old shape" });
    await writer.stop();
    let called = false;
    const stricter: JobDefinition<{ value: string; extra: string }> = {
      name: mismatched.name,
      schema: z.strictObject({ value: z.string(), extra: z.string() })
    };
    await queue.register(stricter, async () => {
      called = true;
    });
    await eventually(() => expect(JSON.stringify(logged)).toContain("test.mismatched"));
    expect(called).toBe(false);
    expect(JSON.stringify(logged)).not.toContain("old shape");
  });

  it("a client can enqueue and does not run the schedule or maintenance", async () => {
    const client = await createPgBossQueue(database.appUrl, { logger, role: "client" });
    await expect(client.enqueue(received, { value: "from-api" })).resolves.toBeUndefined();
    await expect(client.register(received, async () => undefined)).rejects.toThrow(/worker/);
    await client.stop();
  });

  it("an unknown job name is refused at start of work, because the app role cannot create queues", async () => {
    await expect(queue.enqueue(job("test.never-installed"), { value: "x" })).rejects.toThrow();
  });
});

describe("the migrate step and pg-boss", () => {
  let database: TestDatabase;
  let app: pg.Pool;

  beforeAll(async () => {
    database = await withTestDatabase();
    await migrateUp(database.ownerUrl);
    app = new pg.Pool({ connectionString: database.appUrl });
  });
  afterAll(async () => {
    await app.end();
    await database.drop();
  });

  it("installs every declared job, and running it twice is a no-op", async () => {
    await migrateUp(database.ownerUrl);
    const { rows } = await app.query("select name from pgboss.queue order by name");
    expect(rows.map((row: { name: string }) => row.name)).toEqual(expect.arrayContaining(ALL_JOBS.map((definition) => definition.name)));
  });

  it("declares the heartbeat", () => {
    expect(ALL_JOBS).toContain(systemHeartbeat);
    expect(systemHeartbeat.name).toBe("system.heartbeat");
  });

  it("the app role can start pg-boss without migrating", async () => {
    const queue = await createPgBossQueue(database.appUrl, { logger: { info: () => undefined, error: () => undefined }, role: "worker" });
    await queue.stop();
  });

  it.each([
    ["create a table in the pg-boss schema", "create table pgboss.intruder (id int)"],
    ["drop a pg-boss table", "drop table pgboss.job"],
    ["alter a pg-boss table", "alter table pgboss.queue add column intruder int"],
    ["create a table in public", "create table intruder (id int)"],
    ["create a schema", "create schema intruder"]
  ])("the app role cannot %s", async (_name, statement) => {
    await expect(app.query(statement)).rejects.toThrow(/permission denied|must be owner/);
  });
});
