import { createHash } from "node:crypto";
import pg from "pg";
import { PgBoss } from "pg-boss";
import { DEFAULT_RETRY, JOB_EXPIRE_SECONDS, type JobDefinition, type JobHandler, type JobQueue } from "../core/jobs.js";
import { describeJobFailure } from "../logging.js";

const SCHEMA = "pgboss";
const APP_ROLE = "jobflow_app";
const POOL_SIZE = 5;
const STOP_TIMEOUT_MS = 30_000;
const POLLING_INTERVAL_SECONDS = 1;
/** How long the migrate step waits for pg-boss's background index builds. */
const BACKGROUND_BUILD_TIMEOUT_MS = 30 * 60 * 1000;
const BACKGROUND_BUILD_POLL_MS = 500;
/**
 * A real NUL or lone surrogate, as JSON writes them; a valid surrogate pair is written raw. The
 * lookbehind and the pairs of backslashes skip text that only spells out an escape.
 */
const UNSTORABLE_JSON_ESCAPE = /(?<!\\)(?:\\\\)*\\u(?:0000|d[89a-f])/i;

/** Its `err` serializer must keep this adapter's errors safe to log. */
export interface QueueLogger {
  info(details: Record<string, unknown>, message: string): void;
  warn(details: Record<string, unknown>, message: string): void;
  error(details: Record<string, unknown>, message: string): void;
}

function jobOptions<T>(job: JobDefinition<T>) {
  const retry = job.retry ?? DEFAULT_RETRY;
  return { retryLimit: retry.limit, retryDelay: retry.delaySeconds, retryBackoff: retry.backoff, expireInSeconds: job.expireSeconds ?? JOB_EXPIRE_SECONDS };
}

export interface PgBossQueue extends JobQueue {
  register<T>(job: JobDefinition<T>, handler: JobHandler<T>): Promise<void>;
  schedule<T>(job: JobDefinition<T>, cron: string, payload: T): Promise<void>;
  stop(): Promise<void>;
}

export interface QueueOptions {
  readonly logger: QueueLogger;
  /** A worker runs jobs, schedules and maintenance. A client, such as the API, only enqueues. */
  readonly role: "worker" | "client";
  /** How long `stop` waits for running jobs before aborting their signal. */
  readonly stopTimeoutMs?: number;
}

/** The app role cannot change the schema: the migrate step does that with the owner role. */
export function bossRoleOptions(role: QueueOptions["role"]) {
  const isWorker = role === "worker";
  return { migrate: false, createSchema: false, schedule: isWorker, supervise: isWorker };
}

/** A stable job id, because pg-boss ignores a second job with the same id for as long as it keeps the first. */
function jobIdFor(name: string, idempotencyKey: string): string {
  const hash = createHash("sha256").update(`${name}\0${idempotencyKey}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export async function createPgBossQueue(connectionString: string, { logger, role, stopTimeoutMs = STOP_TIMEOUT_MS }: QueueOptions): Promise<PgBossQueue> {
  const isWorker = role === "worker";
  const boss = new PgBoss({ connectionString, schema: SCHEMA, max: POOL_SIZE, ...bossRoleOptions(role) });
  // Required: an unhandled 'error' event would crash the process.
  boss.on("error", (error) => logger.error({ err: error }, "queue error"));
  // Only the type and queue: a warning's text and data can quote a job.
  boss.on("warning", ({ data }) => {
    const { type, queue } = data as { type?: unknown; queue?: unknown };
    logger.warn({ warning: type, queue }, "queue warning");
  });
  try {
    await boss.start();
  } catch (error) {
    // Or the refused start leaves its connections open.
    await boss.stop({ graceful: false }).catch(() => undefined);
    throw error;
  }

  const requireWorker = () => {
    if (!isWorker) throw new Error("Only a worker can run or schedule jobs.");
  };

  return {
    async enqueue(job, payload, options) {
      // As it will be stored, so a payload JSON cannot hold fails here, not when the job runs.
      const data = job.schema.parse(JSON.parse(JSON.stringify(payload))) as object;
      // PostgreSQL refuses these in JSON, with a driver error that quotes the payload.
      if (UNSTORABLE_JSON_ESCAPE.test(JSON.stringify(data))) throw new Error("A job payload cannot hold a NUL or a lone surrogate.");
      await boss.send(job.name, data, {
        ...jobOptions(job),
        ...(options?.idempotencyKey === undefined ? {} : { id: jobIdFor(job.name, options.idempotencyKey) })
      });
    },

    async register(job, handler) {
      requireWorker();
      await boss.work<unknown>(job.name, { batchSize: 1, pollingIntervalSeconds: POLLING_INTERVAL_SECONDS }, async ([entry]) => {
        if (!entry) return;
        const context = { job: job.name, jobId: entry.id, retryCount: entry.retryCount };
        const parsed = job.schema.safeParse(entry.data);
        if (!parsed.success) {
          logger.error(context, "job payload does not fit its schema");
          throw new Error("The job payload does not fit its schema.");
        }
        try {
          await handler(parsed.data, entry.signal);
        } catch (error) {
          logger.error({ ...context, failure: describeJobFailure(error) }, "job failed");
          // pg-boss stores what is thrown in the job's row, and an error's text can quote a CV.
          throw new Error("The job failed. See the worker's log.");
        }
      });
    },

    async schedule(job, cron, payload) {
      requireWorker();
      await boss.schedule(job.name, cron, job.schema.parse(payload) as object, jobOptions(job));
    },

    async stop() {
      await boss.stop({ graceful: true, timeout: stopTimeoutMs });
    }
  };
}

/**
 * An upgrade queues index builds that only an instance with `migrate: true` runs, and this is the
 * only such instance. So it stays until they finish, or a release would report success without them.
 */
async function waitForBackgroundBuilds(boss: PgBoss): Promise<void> {
  const deadline = Date.now() + BACKGROUND_BUILD_TIMEOUT_MS;
  for (;;) {
    const statuses = await boss.getBamStatus();
    if (statuses.some(({ status, count }) => status === "failed" && count > 0)) {
      throw new Error("A pg-boss background index build failed. See pgboss.bam.");
    }
    if (!statuses.some(({ status, count }) => (status === "pending" || status === "in_progress") && count > 0)) return;
    if (Date.now() > deadline) throw new Error("pg-boss background index builds did not finish in time. Run the migrate step again.");
    await new Promise((resolve) => setTimeout(resolve, BACKGROUND_BUILD_POLL_MS));
  }
}

/** With the owner role: installs or upgrades pg-boss, creates the queues, and grants the app role what it needs. */
export async function installJobs(ownerUrl: string, jobs: readonly JobDefinition<never>[]): Promise<void> {
  const boss = new PgBoss({
    connectionString: ownerUrl,
    schema: SCHEMA,
    max: 2,
    migrate: true,
    createSchema: true,
    schedule: false,
    supervise: false,
    // pg-boss's minimum.
    bamIntervalSeconds: 10
  });
  let failure: unknown;
  boss.on("error", (error) => {
    failure = error;
  });
  try {
    await boss.start();
    for (const { name } of jobs) {
      if ((await boss.getQueue(name)) === null) await boss.createQueue(name);
    }
    await waitForBackgroundBuilds(boss);
    if (failure) throw failure;
  } finally {
    await boss.stop({ graceful: true });
  }
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    await client.query(`
      GRANT USAGE ON SCHEMA ${SCHEMA} TO ${APP_ROLE};
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${SCHEMA} TO ${APP_ROLE};
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${SCHEMA} TO ${APP_ROLE};
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${SCHEMA} TO ${APP_ROLE};
    `);
  } finally {
    await client.end();
  }
}
