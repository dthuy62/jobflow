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
  readonly schema: z.ZodType<T>;
  readonly retry?: RetryPolicy;
}

export type JobHandler<T> = (payload: T, signal: AbortSignal) => Promise<void>;

export interface JobQueue {
  /** Validates first, so a bad payload never reaches the queue. An `idempotencyKey` enqueues once. */
  enqueue<T>(job: JobDefinition<T>, payload: T, options?: { readonly idempotencyKey?: string }): Promise<void>;
}

export const systemHeartbeat: JobDefinition<Record<string, never>> = {
  name: "system.heartbeat",
  schema: z.strictObject({})
};

/** Every job the system runs. The migrate step installs these, because the app role cannot create queues. */
export const ALL_JOBS: readonly JobDefinition<never>[] = [systemHeartbeat as JobDefinition<never>];
