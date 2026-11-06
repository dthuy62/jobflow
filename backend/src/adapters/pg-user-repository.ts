import type { Pool } from "pg";
import type { UserId } from "../core/identity.js";
import type { UserRepository } from "../core/ports.js";
import { inTransaction, type Queryable } from "./pg-transaction.js";

interface MemberRow {
  readonly id: string;
  readonly created_at: Date;
  readonly deleted_at: Date | null;
}

const toMember = ({ id, created_at, deleted_at }: MemberRow) => ({
  userId: id as UserId,
  isAnonymous: false,
  createdAt: created_at,
  deleted: deleted_at !== null
});

export type GuestMergeStep = (client: Queryable, guestId: string, memberId: string) => Promise<unknown>;

/**
 * One step per table with user data, run inside the merge's transaction. Add a table here when it
 * ships. Planned rules: preferences keep the member's, and the guest's only fill gaps; tracker
 * entries combine, and for the same job the newer wins; a CV moves only if the member has none,
 * encrypted again with the member's key.
 */
export const GUEST_MERGE_STEPS: readonly GuestMergeStep[] = [
  // An FCM token belongs to a phone and a user. The member's app registers its own.
  (client, guestId) => client.query("DELETE FROM devices WHERE user_id = $1", [guestId])
];

export function createPgUserRepository(pool: Pick<Pool, "query" | "connect">, guestMergeSteps = GUEST_MERGE_STEPS): UserRepository {
  return {
    async findOrCreateMember(subject) {
      // Reads first, so a returning member's sign-in writes nothing to users.
      const existing = await pool.query<MemberRow>("SELECT id, created_at, deleted_at FROM users WHERE auth_subject = $1", [subject]);
      const [found] = existing.rows;
      if (found) return toMember(found);
      // DO UPDATE, not DO NOTHING, so a parallel first sign-in still gets the row back.
      const created = await pool.query<MemberRow>(
        `INSERT INTO users (auth_subject) VALUES ($1)
         ON CONFLICT (auth_subject) DO UPDATE SET auth_subject = EXCLUDED.auth_subject
         RETURNING id, created_at, deleted_at`,
        [subject]
      );
      const [row] = created.rows;
      if (!row) throw new Error("The member upsert returned no row.");
      return toMember(row);
    },

    mergeGuest: (guestTokenHash, memberId) =>
      inTransaction(pool, async (client, rollback) => {
        const owner = await client.query<{ user_id: string }>(
          "SELECT s.user_id FROM refresh_tokens t JOIN sessions s ON s.id = t.session_id WHERE t.token_hash = $1",
          [guestTokenHash]
        );
        const [token] = owner.rows;
        if (!token) return rollback(false);
        // Locks the guest, so a parallel retry or another member waits here and then sees merged_into.
        const users = await client.query<{ id: string; auth_subject: string | null; deleted_at: Date | null; merged_into: string | null }>(
          "SELECT id, auth_subject, deleted_at, merged_into FROM users WHERE id = $1 FOR UPDATE",
          [token.user_id]
        );
        const [guest] = users.rows;
        if (!guest) return rollback(false);
        // A retry after a merge into this member gets the same answer.
        if (guest.deleted_at !== null) return rollback(guest.merged_into === memberId);
        // Only a guest's data moves: a member's token, or the member's own, merges nothing.
        if (guest.auth_subject !== null || guest.id === memberId) return rollback(false);
        // The token must be one the guest's app could still refresh with: unspent, or spent with its answer lost.
        const state = await client.query<{ usable: boolean }>(
          `SELECT s.revoked_at IS NULL AND (t.used_at IS NULL OR EXISTS (
                    SELECT 1 FROM refresh_tokens c WHERE c.parent_hash = t.token_hash AND c.used_at IS NULL)) AS usable
           FROM refresh_tokens t JOIN sessions s ON s.id = t.session_id WHERE t.token_hash = $1`,
          [guestTokenHash]
        );
        if (state.rows[0]?.usable !== true) return rollback(false);
        // Waits for anything closing this member. A closed member must not take the guest's data.
        const member = await client.query<{ deleted_at: Date | null }>("SELECT deleted_at FROM users WHERE id = $1 FOR SHARE", [memberId]);
        if (member.rows[0]?.deleted_at !== null) return rollback(false);
        for (const step of guestMergeSteps) await step(client, guest.id, memberId);
        await client.query("UPDATE users SET deleted_at = now(), merged_into = $2 WHERE id = $1", [guest.id, memberId]);
        await client.query("UPDATE sessions SET revoked_at = now(), revoked_reason = 'merged' WHERE user_id = $1 AND revoked_at IS NULL", [guest.id]);
        return true;
      })
  };
}
