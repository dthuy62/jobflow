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

/** Its `err` serializer must keep this adapter's errors safe to log. */
export interface QueueLogger {
  info(details: Record<string, unknown>, message: string): void;
  error(details: Record<string, unknown>, message: string): void;
}

function jobOptions<T>(job: JobDefinition<T>) {
  const retry = job.retry ?? DEFAULT_RETRY;
  return { retryLimit: retry.limit, retryDelay: retry.delaySeconds, retryBackoff: retry.backoff, expireInSeconds: JOB_EXPIRE_SECONDS };
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
}

/** A stable job id, because pg-boss ignores a second job with the same id for as long as it keeps the first. */
function jobIdFor(name: string, idempotencyKey: string): string {
  const hash = createHash("sha256").update(`${name}\0${idempotencyKey}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export async function createPgBossQueue(connectionString: string, { logger, role }: QueueOptions): Promise<PgBossQueue> {
  const isWorker = role === "worker";
  const boss = new PgBoss({
    connectionString,
    schema: SCHEMA,
    max: POOL_SIZE,
    // The app role cannot change the schema: the migrate step does that with the owner role.
    migrate: false,
    createSchema: false,
    schedule: isWorker,
    supervise: isWorker
  });
  // Required: an unhandled 'error' event would crash the process.
  boss.on("error", (error) => logger.error({ err: error }, "queue error"));
  await boss.start();

  const requireWorker = () => {
    if (!isWorker) throw new Error("Only a worker can run or schedule jobs.");
  };

  return {
    async enqueue(job, payload, options) {
      const data = job.schema.parse(payload) as object;
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
      await boss.stop({ graceful: true, timeout: STOP_TIMEOUT_MS });
    }
  };
}

/** With the owner role: installs or upgrades pg-boss, creates the queues, and grants the app role what it needs. */
export async function installJobs(ownerUrl: string, jobs: readonly JobDefinition<never>[]): Promise<void> {
  const boss = new PgBoss({ connectionString: ownerUrl, schema: SCHEMA, max: 2, migrate: true, createSchema: true, schedule: false, supervise: false });
  let failure: unknown;
  boss.on("error", (error) => {
    failure = error;
  });
  await boss.start();
  try {
    for (const { name } of jobs) {
      if ((await boss.getQueue(name)) === null) await boss.createQueue(name);
    }
    if (failure) throw failure;
  } finally {
    await boss.stop({ graceful: false });
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
