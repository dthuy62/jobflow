import type { Pool, PoolClient } from "pg";

export type Queryable = Pick<PoolClient, "query">;

/** Commits what `work` returns. Any throw rolls back. `rollback` lets `work` end with a rollback and an answer. */
export async function inTransaction<Result>(
  pool: Pick<Pool, "connect">,
  work: (client: Queryable, rollback: <Value>(value: Value) => Promise<Value>) => Promise<Result>
): Promise<Result> {
  const client = await pool.connect();
  let connectionBroken = false;
  let rolledBack = false;
  // A checked-out client has no listener from the pool, and an unheard 'error' would end the process.
  const onConnectionError = () => {
    connectionBroken = true;
  };
  client.on("error", onConnectionError);
  const rollback = async <Value>(value: Value): Promise<Value> => {
    await client.query("ROLLBACK");
    rolledBack = true;
    return value;
  };
  try {
    await client.query("BEGIN");
    const result = await work(client, rollback);
    if (!rolledBack) await client.query("COMMIT");
    return result;
  } catch (error) {
    if (!rolledBack) await client.query("ROLLBACK").catch(onConnectionError);
    throw error;
  } finally {
    client.off("error", onConnectionError);
    // A connection that could not roll back may still hold the transaction, so it must not be reused.
    client.release(connectionBroken);
  }
}
