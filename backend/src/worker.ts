import pino from "pino";
import { createPgBossQueue } from "./adapters/pg-boss-queue.js";
import { loadWorkerConfig } from "./config.js";
import { systemHeartbeat } from "./core/jobs.js";
import { describeFailure, serializeError } from "./logging.js";

const HEARTBEAT_CRON = "* * * * *";

async function main(): Promise<void> {
  const config = loadWorkerConfig(process.env);
  const logger = pino({ base: null, serializers: { err: serializeError } });
  const queue = await createPgBossQueue(config.databaseUrl, { logger, role: "worker" });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void queue.stop().finally(() => process.exit(0));
    });
  }

  await queue.register(systemHeartbeat, async () => {
    logger.info({ job: systemHeartbeat.name }, "heartbeat");
  });
  await queue.schedule(systemHeartbeat, HEARTBEAT_CRON, {});
  // At once too, so a deploy shows at once that the worker runs jobs.
  await queue.enqueue(systemHeartbeat, {});
  logger.info({}, "worker started");
}

main().catch((error: unknown) => {
  console.error(`Worker failed: ${describeFailure(error)}`);
  process.exitCode = 1;
});
