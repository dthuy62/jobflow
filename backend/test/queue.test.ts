import { spawn } from "node:child_process";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createPgBossQueue, installJobs, type PgBossQueue } from "../src/adapters/pg-boss-queue.js";
import { ALL_JOBS, JOB_EXPIRE_SECONDS, systemHeartbeat, type JobDefinition } from "../src/core/jobs.js";
import { migrateUp } from "../src/db/migrate.js";
import { createWorkerLogger } from "../src/logging.js";
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
const scheduled = job("test.scheduled");
const TEST_JOBS = [received, retried, invalid, idempotent, slow, failing, mismatched, scheduled];

describe("the queue, with real PostgreSQL and the app role", () => {
  let database: TestDatabase;
  let queue: PgBossQueue;
  // The worker's real logger, so a test cannot pass where production would log nothing.
  const logged: string[] = [];
  const logger = createWorkerLogger(
    new Writable({
      write(chunk, _encoding, done) {
        logged.push(String(chunk));
        done();
      }
    })
  );

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

  it("a failed job logs enough to find the fault, but no text from the error or payload", async () => {
    let attempted = false;
    await queue.register(failing, async ({ value }) => {
      attempted = true;
      throw Object.assign(new TypeError(`could not parse: ${value}`), { code: "E_PARSE", detail: value });
    });
    await queue.enqueue(failing, { value: "s3cret-cv-text" });
    await eventually(() => expect(attempted).toBe(true));
    await eventually(() => expect(logged.join("")).toContain("job failed"));
    const text = logged.join("");
    expect(text).not.toContain("s3cret");
    const line = JSON.parse(logged.find((entry) => entry.includes("job failed")) ?? "{}");
    expect(line).toMatchObject({ job: "test.failing", failure: { type: "TypeError", code: "E_PARSE" } });
    expect(line.failure.frames).toContain("queue.test.ts");
  });

  it("the job's row holds no text from the error either", async () => {
    const owner = new pg.Client({ connectionString: database.ownerUrl });
    await owner.connect();
    const { rows } = await owner.query("select output from pgboss.job where name = 'test.failing' and output is not null");
    await owner.end();
    expect(JSON.stringify(rows)).not.toContain("s3cret");
  });

  it("a scheduled job gets the same retry and expiry settings as an enqueued one", async () => {
    await queue.schedule(scheduled, "0 0 1 1 *", { value: "x" });
    const owner = new pg.Client({ connectionString: database.ownerUrl });
    await owner.connect();
    const { rows } = await owner.query("select options from pgboss.schedule where name = 'test.scheduled'");
    await owner.end();
    expect(rows[0].options).toMatchObject({ retryLimit: 3, retryDelay: 1, retryBackoff: false, expireInSeconds: JOB_EXPIRE_SECONDS });
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

  it("enqueueing to a queue the migrate step did not install fails, because the adapter creates none", async () => {
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

describe("the worker process", () => {
  const workerFile = fileURLToPath(new URL("../src/worker.ts", import.meta.url));

  function startWorker(databaseUrl: string) {
    const child = spawn(process.execPath, ["--import", "tsx", workerFile], {
      env: { PATH: process.env.PATH, JOBFLOW_ENV: "test", DATABASE_URL: databaseUrl },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += String(chunk)));
    child.stderr.on("data", (chunk) => (output += String(chunk)));
    const exited = new Promise<number | null>((resolve) => child.once("exit", resolve));
    return { child, exited, output: () => output };
  }

  it("runs, and exits 0 on SIGTERM", async () => {
    const database = await withTestDatabase();
    try {
      await migrateUp(database.ownerUrl);
      const worker = startWorker(database.appUrl);
      await vi.waitFor(() => expect(worker.output()).toContain("worker started"), { timeout: 20_000, interval: 200 });
      worker.child.kill("SIGTERM");
      expect(await worker.exited).toBe(0);
    } finally {
      await database.drop();
    }
  }, 40_000);

  it("exits 1 when it cannot run, so an orchestrator sees the failure instead of a hung process", async () => {
    const database = await withTestDatabase();
    try {
      // pg-boss is installed, but the heartbeat's queue is not, as when a release skips the migrate step.
      await installJobs(database.ownerUrl, []);
      const worker = startWorker(database.appUrl);
      const timeout = setTimeout(() => worker.child.kill("SIGKILL"), 30_000);
      expect(await worker.exited).toBe(1);
      clearTimeout(timeout);
      expect(worker.output()).toContain("Worker failed");
    } finally {
      await database.drop();
    }
  }, 40_000);
});
