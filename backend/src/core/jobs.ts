import { z } from "zod";

export interface RetryPolicy {
  readonly limit: number;
  readonly delaySeconds: number;
  readonly backoff: boolean;
}

export const DEFAULT_RETRY: RetryPolicy = { limit: 3, delaySeconds: 5, backoff: true };
/** How long a job may run before it counts as failed and is retried. */
export const JOB_EXPIRE_SECONDS = 300;

export interface JobDefinition<T> {
  readonly name: string;
  /** Must fit what JSON can hold, because the payload is stored as JSON and parsed again when it runs. */
  readonly schema: z.ZodType<T>;
  readonly retry?: RetryPolicy;
  readonly expireSeconds?: number;
}

export type JobHandler<T> = (payload: T, signal: AbortSignal) => Promise<void>;

export interface JobQueue {
  /**
   * Validates first, so a bad payload never reaches the queue. An `idempotencyKey` enqueues once
   * for as long as the job's row is kept, including after it failed. So a retry the user asks for
   * needs a new key, such as one with an attempt number, and a key can run again after retention.
   */
  enqueue<T>(job: JobDefinition<T>, payload: T, options?: { readonly idempotencyKey?: string }): Promise<void>;
}

export const systemHeartbeat: JobDefinition<Record<string, never>> = {
  name: "system.heartbeat",
  schema: z.strictObject({})
};

/** Every job the system runs. The migrate step creates their queues; nothing creates a queue at run time. */
export const ALL_JOBS: readonly JobDefinition<never>[] = [systemHeartbeat as JobDefinition<never>];
