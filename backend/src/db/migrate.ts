import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";
import { installJobs } from "../adapters/pg-boss-queue.js";
import { ALL_JOBS } from "../core/jobs.js";

const MIGRATIONS_DIR = fileURLToPath(new URL("../../migrations", import.meta.url));

/** A separate step with the owner role, never run at API start: the app role cannot change the schema. */
export async function migrateUp(databaseUrl: string): Promise<void> {
  await runner({
    databaseUrl,
    dir: MIGRATIONS_DIR,
    migrationsTable: "pgmigrations",
    direction: "up",
    count: Number.POSITIVE_INFINITY,
    singleTransaction: true,
    checkOrder: true,
    log: () => undefined
  });
  await installJobs(databaseUrl, ALL_JOBS);
}
