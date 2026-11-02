import { fileURLToPath } from "node:url";
import { runner } from "node-pg-migrate";
import { loadMigrationUrl } from "../config.js";
import { redactLogText } from "../logging.js";

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
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrateUp(loadMigrationUrl(process.env)).catch((error: unknown) => {
    console.error(`Migration failed: ${redactLogText(error instanceof Error ? error.message : String(error))}`);
    process.exitCode = 1;
  });
}
