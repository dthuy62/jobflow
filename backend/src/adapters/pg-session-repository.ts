import type { Pool } from "pg";
import type { Account, SessionId, UserId } from "../core/identity.js";
import type { SessionRepository } from "../core/ports.js";
import { inTransaction } from "./pg-transaction.js";

interface AccountRow {
  readonly user_id: string;
  readonly is_guest: boolean;
  readonly created_at: Date;
}

const toAccount = ({ user_id, is_guest, created_at }: AccountRow): Account => ({ userId: user_id as UserId, isAnonymous: is_guest, createdAt: created_at });

const firstRow = <Row>(rows: Row[], what: string): Row => {
  const [row] = rows;
  if (!row) throw new Error(`The ${what} returned no row.`);
  return row;
};

export function createPgSessionRepository(pool: Pick<Pool, "query" | "connect">): SessionRepository {
  return {
    async startGuest(tokenHash) {
      // One statement, so a failure leaves no guest without a session.
      const { rows } = await pool.query<AccountRow & { session_id: string }>(
        `WITH guest AS (INSERT INTO users DEFAULT VALUES RETURNING id, created_at),
              session AS (INSERT INTO sessions (user_id) SELECT id FROM guest RETURNING id),
              token AS (INSERT INTO refresh_tokens (token_hash, session_id) SELECT $1, id FROM session)
         SELECT guest.id AS user_id, true AS is_guest, guest.created_at, session.id AS session_id FROM guest, session`,
        [tokenHash]
      );
      const row = firstRow(rows, "guest insert");
      return { account: toAccount(row), sessionId: row.session_id as SessionId };
    },

    async start(userId, tokenHash) {
      const { rows } = await pool.query<{ id: string }>(
        `WITH session AS (INSERT INTO sessions (user_id) VALUES ($1) RETURNING id),
              token AS (INSERT INTO refresh_tokens (token_hash, session_id) SELECT $2, id FROM session)
         SELECT id FROM session`,
        [userId, tokenHash]
      );
      return firstRow(rows, "session insert").id as SessionId;
    },

    rotate: (tokenHash, nextHash) =>
      inTransaction(pool, async (client) => {
        // Locks the session, so every rotation, revocation and reuse check in it runs one at a time.
        const session = await client.query<{ id: string; user_id: string }>(
          `SELECT s.id, s.user_id FROM refresh_tokens t
           JOIN sessions s ON s.id = t.session_id
           JOIN users u ON u.id = s.user_id
           WHERE t.token_hash = $1 AND s.revoked_at IS NULL AND u.deleted_at IS NULL
           FOR UPDATE OF s`,
          [tokenHash]
        );
        const [live] = session.rows;
        // Rule 4: an unknown token, or one of a revoked session, a deleted user or a merged guest.
        if (!live) return undefined;
        // Read after the lock, so a parallel rotation's writes are seen.
        const { rows } = await client.query<{ used: boolean; unused_child: Buffer | null }>(
          `SELECT t.used_at IS NOT NULL AS used,
                  (SELECT c.token_hash FROM refresh_tokens c WHERE c.parent_hash = t.token_hash AND c.used_at IS NULL) AS unused_child
           FROM refresh_tokens t WHERE t.token_hash = $1`,
          [tokenHash]
        );
        const token = firstRow(rows, "token read");
        if (!token.used) {
          // Rule 1: spend it.
          await client.query("UPDATE refresh_tokens SET used_at = now() WHERE token_hash = $1", [tokenHash]);
        } else if (token.unused_child) {
          // Rule 2: the app lost the answer. Spending the child also means its later use counts as reuse.
          await client.query("UPDATE refresh_tokens SET used_at = now() WHERE token_hash = $1", [token.unused_child]);
        } else {
          // Rule 3: its child was used too, so two holders have this chain.
          await client.query("UPDATE sessions SET revoked_at = now(), revoked_reason = 'reuse' WHERE id = $1", [live.id]);
          return undefined;
        }
        await client.query("INSERT INTO refresh_tokens (token_hash, session_id, parent_hash) VALUES ($1, $2, $3)", [nextHash, live.id, tokenHash]);
        return { userId: live.user_id as UserId, sessionId: live.id as SessionId };
      }),

    async revoke(sessionId, reason) {
      await pool.query("UPDATE sessions SET revoked_at = now(), revoked_reason = $2 WHERE id = $1 AND revoked_at IS NULL", [sessionId, reason]);
    },

    async findActive(sessionId, userId) {
      const { rows } = await pool.query<AccountRow>(
        `SELECT u.id AS user_id, u.auth_subject IS NULL AS is_guest, u.created_at
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL AND u.deleted_at IS NULL`,
        [sessionId, userId]
      );
      const [row] = rows;
      return row && toAccount(row);
    }
  };
}
