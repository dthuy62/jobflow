import type { Pool } from "pg";
import type { Account, SessionId, UserId } from "../core/identity.js";
import type { SessionRepository } from "../core/ports.js";

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

export function createPgSessionRepository(pool: Pick<Pool, "query">): SessionRepository {
  return {
    async startGuest(tokenHash) {
      // One statement, so a failure leaves no guest without a session.
      const { rows } = await pool.query<AccountRow & { session_id: string }>(
        `WITH guest AS (INSERT INTO users DEFAULT VALUES RETURNING id, created_at),
              session AS (INSERT INTO sessions (user_id, refresh_token_hash) SELECT id, $1 FROM guest RETURNING id)
         SELECT guest.id AS user_id, true AS is_guest, guest.created_at, session.id AS session_id FROM guest, session`,
        [tokenHash]
      );
      const row = firstRow(rows, "guest insert");
      return { account: toAccount(row), sessionId: row.session_id as SessionId };
    },

    async start(userId, tokenHash) {
      const { rows } = await pool.query<{ id: string }>("INSERT INTO sessions (user_id, refresh_token_hash) VALUES ($1, $2) RETURNING id", [
        userId,
        tokenHash
      ]);
      return firstRow(rows, "session insert").id as SessionId;
    },

    async findByRefreshToken(tokenHash) {
      const { rows } = await pool.query<{ id: string; user_id: string }>(
        `SELECT s.id, s.user_id FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.refresh_token_hash = $1 AND s.revoked_at IS NULL AND u.deleted_at IS NULL`,
        [tokenHash]
      );
      const [row] = rows;
      return row && { userId: row.user_id as UserId, sessionId: row.id as SessionId };
    },

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
