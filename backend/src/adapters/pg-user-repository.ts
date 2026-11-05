import type { Pool, PoolClient } from "pg";
import type { UserId } from "../core/identity.js";
import type { ResolvedUser, UserRepository } from "../core/ports.js";

interface UserRow {
  readonly id: string;
  readonly created_at: Date;
  readonly deleted_at: Date | null;
  readonly linked_at: Date | null;
}

const toUser = ({ id, created_at, deleted_at }: UserRow): ResolvedUser => ({
  id: id as UserId,
  createdAt: created_at,
  deleted: deleted_at !== null
});

export type GuestMergeStep = (client: Pick<PoolClient, "query">, guestId: string, memberId: string) => Promise<unknown>;

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
    async resolve(subject, isAnonymous) {
      // Reads first, so a known user's request writes nothing: this runs on every request.
      const existing = await pool.query<UserRow>("SELECT id, created_at, deleted_at, linked_at FROM users WHERE auth_subject = $1", [subject]);
      const [found] = existing.rows;
      if (found) {
        if (!isAnonymous && found.linked_at === null && found.deleted_at === null) {
          await pool.query("UPDATE users SET linked_at = now() WHERE id = $1 AND linked_at IS NULL", [found.id]);
        }
        return toUser(found);
      }
      // DO UPDATE, not DO NOTHING, so a parallel first request still gets the row back.
      const created = await pool.query<UserRow>(
        `INSERT INTO users (auth_subject, linked_at) VALUES ($1, CASE WHEN $2::boolean THEN NULL ELSE now() END)
         ON CONFLICT (auth_subject) DO UPDATE SET linked_at = COALESCE(users.linked_at, EXCLUDED.linked_at)
         RETURNING id, created_at, deleted_at, linked_at`,
        [subject, isAnonymous]
      );
      const [row] = created.rows;
      if (!row) throw new Error("The user upsert returned no row.");
      return toUser(row);
    },

    async mergeGuest(guestSubject, memberId) {
      const client = await pool.connect();
      let connectionBroken = false;
      // A checked-out client has no listener from the pool, and an unheard 'error' would end the process.
      const onConnectionError = () => {
        connectionBroken = true;
      };
      client.on("error", onConnectionError);
      try {
        await client.query("BEGIN");
        // The lock makes a parallel retry wait here and then see merged_into. A guest with no row has no data.
        const { rows } = await client.query<{ id: string; deleted_at: Date | null; linked_at: Date | null; merged_into: string | null }>(
          "SELECT id, deleted_at, linked_at, merged_into FROM users WHERE auth_subject = $1 FOR UPDATE",
          [guestSubject]
        );
        const [guest] = rows;
        // shortcut: a user Firebase linked, whose new token never reached this server, looks like any guest here, so its old anonymous token can still close it within the hour. Ask Firebase for the user's providers if that ever matters.
        if (!guest || guest.id === memberId || guest.linked_at !== null || guest.deleted_at !== null) {
          await client.query("ROLLBACK");
          return guest?.merged_into === memberId;
        }
        for (const step of guestMergeSteps) await step(client, guest.id, memberId);
        await client.query("UPDATE users SET deleted_at = now(), merged_into = $2 WHERE id = $1", [guest.id, memberId]);
        await client.query("COMMIT");
        return true;
      } catch (error) {
        await client.query("ROLLBACK").catch(onConnectionError);
        throw error;
      } finally {
        client.off("error", onConnectionError);
        // A connection that could not roll back may still hold the transaction, so it must not be reused.
        client.release(connectionBroken);
      }
    }
  };
}
