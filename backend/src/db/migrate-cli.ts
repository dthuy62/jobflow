import { loadMigrationUrl } from "../config.js";
import { redactLogText } from "../logging.js";
import { migrateUp } from "./migrate.js";

// Its own file with no "am I the entry point" check, which is false through a symlinked path
// and would skip the migration while exiting 0.
try {
  await migrateUp(loadMigrationUrl(process.env));
} catch (error) {
  console.error(`Migration failed: ${redactLogText(error instanceof Error ? error.message : String(error))}`);
  process.exitCode = 1;
}
