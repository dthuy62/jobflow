import pg from "pg";

const CONNECT_TIMEOUT_MS = 5_000;
const STATEMENT_TIMEOUT_MS = 10_000;
/** The server enforces the statement timeout, so it cannot fire when packets stop. This one can, and it frees the slot. */
const QUERY_TIMEOUT_MS = STATEMENT_TIMEOUT_MS + 1_000;

/** `onIdleError` is required because an idle client's error would otherwise crash the process. */
export function createPool(connectionString: string, onIdleError: (error: Error) => void): pg.Pool {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    keepAlive: true
  });
  pool.on("error", onIdleError);
  return pool;
}
