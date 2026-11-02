import type { Pool } from "pg";
import type { UserId } from "../core/identity.js";
import type { ResolvedUser, UserRepository } from "../core/ports.js";

interface UserRow {
  readonly id: string;
  readonly created_at: Date;
  readonly deleted_at: Date | null;
}

const toUser = ({ id, created_at, deleted_at }: UserRow): ResolvedUser => ({
  id: id as UserId,
  createdAt: created_at,
  deleted: deleted_at !== null
});

export function createPgUserRepository(pool: Pick<Pool, "query">): UserRepository {
  return {
    async resolve(subject) {
      // Reads first, so a known user's request writes nothing: this runs on every request.
      const existing = await pool.query<UserRow>("SELECT id, created_at, deleted_at FROM users WHERE auth_subject = $1", [subject]);
      const [found] = existing.rows;
      if (found) return toUser(found);
      // DO UPDATE, not DO NOTHING, so a parallel first request still gets the row back.
      const created = await pool.query<UserRow>(
        `INSERT INTO users (auth_subject) VALUES ($1)
         ON CONFLICT (auth_subject) DO UPDATE SET auth_subject = EXCLUDED.auth_subject
         RETURNING id, created_at, deleted_at`,
        [subject]
      );
      const [row] = created.rows;
      if (!row) throw new Error("The user upsert returned no row.");
      return toUser(row);
    }
  };
}
