import { createPgBossQueue } from "./adapters/pg-boss-queue.js";
import { loadWorkerConfig } from "./config.js";
import { systemHeartbeat } from "./core/jobs.js";
import { createWorkerLogger, describeFailure } from "./logging.js";

const HEARTBEAT_CRON = "* * * * *";

async function main(): Promise<void> {
  const config = loadWorkerConfig(process.env);
  const logger = createWorkerLogger();
  const queue = await createPgBossQueue(config.databaseUrl, { logger, role: "worker" });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void queue.stop().finally(() => process.exit(0));
    });
  }

  try {
    await queue.register(systemHeartbeat, async () => {
      logger.info({ job: systemHeartbeat.name }, "heartbeat");
    });
    await queue.schedule(systemHeartbeat, HEARTBEAT_CRON, {});
  } catch (error) {
    await queue.stop();
    throw error;
  }
  logger.info({}, "worker started");
}

main().catch((error: unknown) => {
  console.error(`Worker failed: ${describeFailure(error)}`);
  // A process that stays up would look healthy to whatever should restart it.
  process.exit(1);
});
