import { ErrorResponseDtoSchema, GuestResponseDtoSchema, MeDtoSchema, SessionTokensDtoSchema, SsoResponseDtoSchema } from "@jobflow/contract";
import type { InjectOptions } from "fastify";
import { SignJWT } from "jose";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ACCESS_TOKEN_AUDIENCE, ACCESS_TOKEN_ISSUER } from "../src/adapters/jwt-access-tokens.js";
import { GUEST_MERGE_STEPS, type GuestMergeStep } from "../src/adapters/pg-user-repository.js";
import { createPgUserRepository } from "../src/adapters/pg-user-repository.js";
import { hashRefreshToken } from "../src/core/auth-service.js";
import type { UserId } from "../src/core/identity.js";
import { migrateUp } from "../src/db/migrate.js";
import { createPool } from "../src/db/pool.js";
import { createServer } from "../src/server.js";
import { GUEST_LIMIT_PER_MINUTE } from "../src/http/rate-limits.js";
import { withTestDatabase, type TestDatabase } from "./support/database.js";
import { createRealAuth, createTestServer, testConfig } from "./support/server.js";

type Server = Awaited<ReturnType<typeof createServer>>;
type Tokens = { accessToken: string; refreshToken: string; expiresIn: number };

describe("the auth routes, with real PostgreSQL and the app role", () => {
  let database: TestDatabase;
  let pool: pg.Pool;
  let server: Server;

  beforeAll(async () => {
    database = await withTestDatabase();
    await migrateUp(database.ownerUrl);
    pool = createPool(database.appUrl, () => undefined);
    server = await serverWith();
  });
  afterAll(async () => {
    await server.close();
    await pool.end();
    await database.drop();
  });

  const serverWith = (steps: readonly GuestMergeStep[] = GUEST_MERGE_STEPS) =>
    createServer({ config: testConfig, pool, auth: createRealAuth(pool, { steps }) });

  // Each call from its own address, so the per-address limits never decide a test that is not about them.
  let address = 0;
  const call = (options: InjectOptions, target = server) => {
    address += 1;
    return target.inject({ remoteAddress: `10.${(address >> 16) & 255}.${(address >> 8) & 255}.${address & 255}`, ...options });
  };
  const bearer = (tokens: Pick<Tokens, "accessToken">) => ({ authorization: `Bearer ${tokens.accessToken}` });

  const newGuest = async () => {
    const response = await call({ method: "POST", url: "/api/v1/auth/guest" });
    expect(response.statusCode).toBe(200);
    return GuestResponseDtoSchema.parse(response.json());
  };
  const sso = (body: object, target = server) => call({ method: "POST", url: "/api/v1/auth/sso", payload: body }, target);
  const signIn = async (subject: string, guestRefreshToken?: string) => {
    const response = await sso({ idToken: `id-${subject}`, ...(guestRefreshToken === undefined ? {} : { guestRefreshToken }) });
    expect(response.statusCode, response.body).toBe(200);
    return SsoResponseDtoSchema.parse(response.json());
  };
  const refresh = (refreshToken: string) => call({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken } });
  const refreshed = async (refreshToken: string) => {
    const response = await refresh(refreshToken);
    expect(response.statusCode, response.body).toBe(200);
    return SessionTokensDtoSchema.parse(response.json());
  };
  const me = (tokens: Pick<Tokens, "accessToken">) => call({ url: "/api/v1/me", headers: bearer(tokens) });
  const logout = (tokens: Pick<Tokens, "accessToken">, body: unknown) =>
    call({ method: "POST", url: "/api/v1/auth/logout", headers: bearer(tokens), payload: body as object });

  const codeOf = (response: { json(): unknown }) => ErrorResponseDtoSchema.parse(response.json()).error.code;
  const userRow = async (userId: string) =>
    (await pool.query("select id, auth_subject, deleted_at, merged_into, xmin::text as version from users where id = $1", [userId])).rows[0];
  const sessionOf = async (tokens: Pick<Tokens, "refreshToken">) =>
    (
      await pool.query("select s.id, s.revoked_at, s.revoked_reason from refresh_tokens t join sessions s on s.id = t.session_id where t.token_hash = $1", [
        hashRefreshToken(tokens.refreshToken)
      ])
    ).rows[0];
  const seedDevice = (userId: string, installationId: string) =>
    pool.query("insert into devices (user_id, installation_id, fcm_token) values ($1, $2, 'synthetic-fcm')", [userId, installationId]);
  const devicesOf = async (userId: string) =>
    (await pool.query("select installation_id from devices where user_id = $1 order by 1", [userId])).rows.map((row) => row.installation_id);

  describe("POST /auth/guest", () => {
    it("creates a guest with a session: a 15-minute access token that works, and a refresh token", async () => {
      const { tokens, account } = await newGuest();
      expect(account.isAnonymous).toBe(true);
      expect(tokens.expiresIn).toBe(900);
      expect(tokens.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(MeDtoSchema.parse((await me(tokens)).json())).toEqual(account);
      expect((await userRow(account.userId)).auth_subject).toBeNull();
    });

    it("needs no token, and makes a new guest on each call", async () => {
      const first = await newGuest();
      const second = await newGuest();
      expect(first.account.userId).not.toBe(second.account.userId);
    });

    it("stores only the refresh token's hash", async () => {
      const { tokens } = await newGuest();
      const stored = (await pool.query("select encode(token_hash, 'hex') as hash from refresh_tokens")).rows.map((row) => row.hash as string);
      expect(stored).toContain(hashRefreshToken(tokens.refreshToken).toString("hex"));
      const dump = JSON.stringify((await pool.query("select * from refresh_tokens")).rows);
      expect(dump).not.toContain(tokens.refreshToken);
    });

    it(`allows ${GUEST_LIMIT_PER_MINUTE} a minute per address, and other addresses go on`, async () => {
      const fromOne = () => server.inject({ method: "POST", url: "/api/v1/auth/guest", remoteAddress: "192.0.2.10" });
      for (let index = 0; index < GUEST_LIMIT_PER_MINUTE; index += 1) expect((await fromOne()).statusCode).toBe(200);
      const limited = await fromOne();
      expect(limited.statusCode).toBe(429);
      expect(codeOf(limited)).toBe("RATE_LIMITED");
      expect((await server.inject({ method: "POST", url: "/api/v1/auth/guest", remoteAddress: "192.0.2.11" })).statusCode).toBe(200);
      // Only guests count: the same address still refreshes.
      const { tokens } = await newGuest();
      expect((await server.inject({ method: "POST", url: "/api/v1/auth/refresh", remoteAddress: "192.0.2.10", payload: { refreshToken: tokens.refreshToken } })).statusCode).toBe(200);
    });
  });

  describe("POST /auth/refresh", () => {
    it("rule 1: an unused token is spent and gets a new pair for the same session and user", async () => {
      const { tokens, account } = await newGuest();
      const next = await refreshed(tokens.refreshToken);
      expect(next.refreshToken).not.toBe(tokens.refreshToken);
      expect((await sessionOf(next)).id).toBe((await sessionOf(tokens)).id);
      expect(MeDtoSchema.parse((await me(next)).json()).userId).toBe(account.userId);
      expect((await refreshed(next.refreshToken)).refreshToken).toBeDefined();
    });

    it("rule 2: a spent token whose child is unused means the answer was lost: a new pair, and the lost child is dead", async () => {
      const { tokens } = await newGuest();
      const lost = await refreshed(tokens.refreshToken);
      const again = await refreshed(tokens.refreshToken);
      expect(again.refreshToken).not.toBe(lost.refreshToken);
      expect((await sessionOf(again)).revoked_at).toBeNull();
      expect(await refreshed(again.refreshToken)).toBeDefined();
    });

    it("rule 2, more than once in a row", async () => {
      const { tokens } = await newGuest();
      for (let attempt = 0; attempt < 3; attempt += 1) await refreshed(tokens.refreshToken);
      const last = await refreshed(tokens.refreshToken);
      expect(await refreshed(last.refreshToken)).toBeDefined();
    });

    it("rule 2 then a use of the lost child: two holders, so the session is revoked", async () => {
      const { tokens } = await newGuest();
      const lost = await refreshed(tokens.refreshToken);
      const kept = await refreshed(tokens.refreshToken);
      expect((await refresh(lost.refreshToken)).statusCode).toBe(401);
      expect((await sessionOf(kept)).revoked_reason).toBe("reuse");
      expect((await refresh(kept.refreshToken)).statusCode).toBe(401);
      expect((await me(kept)).statusCode).toBe(401);
    });

    it("rule 3: a spent token whose child was used revokes the session, and every token of it gets 401", async () => {
      const { tokens } = await newGuest();
      const second = await refreshed(tokens.refreshToken);
      const third = await refreshed(second.refreshToken);
      const replay = await refresh(tokens.refreshToken);
      expect(replay.statusCode).toBe(401);
      expect(codeOf(replay)).toBe("UNAUTHORIZED");
      expect((await sessionOf(third)).revoked_reason).toBe("reuse");
      expect((await refresh(third.refreshToken)).statusCode).toBe(401);
      expect((await me(third)).statusCode).toBe(401);
    });

    it("rule 3 leaves the user's other sessions alone", async () => {
      const phone = await signIn("two-phones");
      const tablet = await signIn("two-phones");
      const next = await refreshed(phone.tokens.refreshToken);
      await refreshed(next.refreshToken);
      expect((await refresh(phone.tokens.refreshToken)).statusCode).toBe(401);
      expect((await me(tablet.tokens)).statusCode).toBe(200);
      expect(await refreshed(tablet.tokens.refreshToken)).toBeDefined();
    });

    it("rule 3 has no time limit: a token spent long ago, replayed, still revokes the session", async () => {
      const { tokens } = await newGuest();
      const second = await refreshed(tokens.refreshToken);
      const third = await refreshed(second.refreshToken);
      await pool.query("update refresh_tokens set used_at = now() - interval '90 days' where token_hash = $1", [hashRefreshToken(tokens.refreshToken)]);
      await refreshed(third.refreshToken);
      expect((await refresh(tokens.refreshToken)).statusCode).toBe(401);
      expect((await sessionOf(third)).revoked_reason).toBe("reuse");
    });

    it("keeps a spent token whose answer was lost, however old, so the app can still recover", async () => {
      const { tokens } = await newGuest();
      await refreshed(tokens.refreshToken);
      await pool.query("update refresh_tokens set used_at = now() - interval '30 days' where token_hash = $1", [hashRefreshToken(tokens.refreshToken)]);
      const recovered = await refreshed(tokens.refreshToken);
      expect(await refreshed(recovered.refreshToken)).toBeDefined();
    });

    it("removing an old token never takes the newer ones of its chain along", async () => {
      const { tokens } = await newGuest();
      const second = await refreshed(tokens.refreshToken);
      await pool.query("delete from refresh_tokens where token_hash = $1", [hashRefreshToken(tokens.refreshToken)]);
      expect(await refreshed(second.refreshToken)).toBeDefined();
    });

    it.each([
      ["unknown", "x".repeat(43)],
      ["empty", ""],
      ["very long", "x".repeat(10_000)]
    ])("rule 4: an %s token gets 401", async (_name, token) => {
      const response = await refresh(token);
      expect(response.statusCode).toBe(401);
      expect(codeOf(response)).toBe("UNAUTHORIZED");
    });

    it("rule 4: a token of a logged-out session gets 401, and does not count as reuse", async () => {
      const { tokens } = await signIn("logged-out");
      expect((await logout(tokens, { installationId: "phone" })).statusCode).toBe(204);
      expect((await refresh(tokens.refreshToken)).statusCode).toBe(401);
      expect((await sessionOf(tokens)).revoked_reason).toBe("logout");
    });

    it("rule 4: a deleted user's token gets 401", async () => {
      const { tokens, account } = await signIn("refresh-deleted");
      await pool.query("update users set deleted_at = now() where id = $1", [account.userId]);
      expect((await refresh(tokens.refreshToken)).statusCode).toBe(401);
    });

    it("parallel uses of one token all answer, without a 5xx, and leave one live token in the session", async () => {
      for (let round = 0; round < 5; round += 1) {
        const { tokens } = await newGuest();
        const responses = await Promise.all([1, 2, 3].map(() => refresh(tokens.refreshToken)));
        expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 200]);
        const { id } = await sessionOf(tokens);
        const unused = await pool.query("select 1 from refresh_tokens where session_id = $1 and used_at is null", [id]);
        expect(unused.rowCount).toBe(1);
      }
    });

    it.each([
      ["no token", {}],
      ["a token that is not a string", { refreshToken: 1 }],
      ["an extra field", { refreshToken: "x", userId: "user_2" }]
    ])("answers 400 to %s", async (_name, body) => {
      const response = await call({ method: "POST", url: "/api/v1/auth/refresh", payload: body });
      expect(response.statusCode).toBe(400);
      expect(codeOf(response)).toBe("VALIDATION_ERROR");
    });
  });

  describe("the auth hook", () => {
    const forge = (claims: { sub: string; sid: string }, secret = testConfig.jwtSigningKeys[0]?.secret ?? "") =>
      new SignJWT({ sid: claims.sid })
        .setProtectedHeader({ alg: "HS256", kid: "test-1" })
        .setIssuer(ACCESS_TOKEN_ISSUER)
        .setAudience(ACCESS_TOKEN_AUDIENCE)
        .setSubject(claims.sub)
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(new TextEncoder().encode(secret));

    it("refuses a token that pairs one user with another user's session", async () => {
      const victim = await signIn("hook-victim");
      const attacker = await signIn("hook-attacker");
      const token = await forge({ sub: attacker.account.userId, sid: (await sessionOf(victim.tokens)).id });
      expect((await me({ accessToken: token })).statusCode).toBe(401);
      const reverse = await forge({ sub: victim.account.userId, sid: (await sessionOf(attacker.tokens)).id });
      expect((await me({ accessToken: reverse })).statusCode).toBe(401);
    });

    it("refuses a token signed with a key it does not hold", async () => {
      const { tokens, account } = await signIn("hook-key");
      const token = await forge({ sub: account.userId, sid: (await sessionOf(tokens)).id }, "dev-only-some-other-secret-0123456789abcdef");
      expect((await me({ accessToken: token })).statusCode).toBe(401);
    });

    it("gives every user only their own account", async () => {
      const one = await newGuest();
      const two = await signIn("hook-two");
      expect(MeDtoSchema.parse((await me(one.tokens)).json()).userId).toBe(one.account.userId);
      expect(MeDtoSchema.parse((await me(two.tokens)).json()).userId).toBe(two.account.userId);
    });

    it("reads the session and the user in one query", async () => {
      const { tokens } = await newGuest();
      const queries: string[] = [];
      const counting = { query: (async (sql: string, args: unknown[]) => (queries.push(sql), pool.query(sql, args as never[]))) as never, connect: pool.connect.bind(pool) };
      const counted = await createServer({ config: testConfig, pool, auth: createRealAuth(counting) });
      expect((await call({ url: "/api/v1/me", headers: bearer(tokens) }, counted)).statusCode).toBe(200);
      await counted.close();
      expect(queries).toHaveLength(1);
    });
  });

  describe("POST /auth/sso", () => {
    it("creates the member on the first sign-in and finds it after, each time with its own session", async () => {
      const first = await signIn("member-new");
      expect(first.account.isAnonymous).toBe(false);
      expect(first.guestMerged).toBe(false);
      const second = await signIn("member-new");
      expect(second.account).toEqual(first.account);
      expect((await sessionOf(second.tokens)).id).not.toBe((await sessionOf(first.tokens)).id);
      expect((await me(first.tokens)).statusCode).toBe(200);
      expect((await me(second.tokens)).statusCode).toBe(200);
      expect((await userRow(first.account.userId)).auth_subject).toBe("member-new");
    });

    it("writes nothing to the member's row when it signs in again", async () => {
      const { account } = await signIn("member-quiet");
      const { version } = await userRow(account.userId);
      await signIn("member-quiet");
      expect((await userRow(account.userId)).version).toBe(version);
    });

    it("refuses an anonymous ID token with 403, and creates no one", async () => {
      const response = await sso({ idToken: "id-anon-someone" });
      expect(response.statusCode).toBe(403);
      expect(codeOf(response)).toBe("SIGN_IN_REQUIRED");
      expect((await pool.query("select 1 from users where auth_subject = 'anon-someone'")).rowCount).toBe(0);
    });

    it("refuses an invalid ID token with 401, and leaves the guest as it was", async () => {
      const guest = await newGuest();
      const response = await sso({ idToken: "garbage", guestRefreshToken: guest.tokens.refreshToken });
      expect(response.statusCode).toBe(401);
      expect(codeOf(response)).toBe("UNAUTHORIZED");
      expect((await me(guest.tokens)).statusCode).toBe(200);
      expect((await userRow(guest.account.userId)).deleted_at).toBeNull();
    });

    it("answers 503 AUTH_UNAVAILABLE when the ID token cannot be checked, and the guest stays", async () => {
      const guest = await newGuest();
      const response = await sso({ idToken: "id-outage", guestRefreshToken: guest.tokens.refreshToken });
      expect(response.statusCode).toBe(503);
      expect(codeOf(response)).toBe("AUTH_UNAVAILABLE");
      expect((await me(guest.tokens)).statusCode).toBe(200);
    });

    it("refuses a member that was deleted, and does not revive it", async () => {
      const { account } = await signIn("member-deleted");
      await pool.query("update users set deleted_at = now() where id = $1", [account.userId]);
      expect((await sso({ idToken: "id-member-deleted" })).statusCode).toBe(401);
      expect((await userRow(account.userId)).deleted_at).not.toBeNull();
    });

    it.each([
      ["no idToken", {}],
      ["an idToken that is not a string", { idToken: 1 }],
      ["a guestRefreshToken that is not a string", { idToken: "id-member-bad", guestRefreshToken: 1 }],
      ["a user id in the body", { idToken: "id-member-bad", userId: "user_2" }]
    ])("answers 400 to %s", async (_name, body) => {
      const response = await sso(body);
      expect(response.statusCode).toBe(400);
      expect(codeOf(response)).toBe("VALIDATION_ERROR");
    });

    it("merges a guest: moves its data, closes it, and revokes its session", async () => {
      const guest = await newGuest();
      await seedDevice(guest.account.userId, "guest-phone");
      const result = await signIn("member-merge", guest.tokens.refreshToken);
      expect(result.guestMerged).toBe(true);
      const row = await userRow(guest.account.userId);
      expect(row.deleted_at).not.toBeNull();
      expect(row.merged_into).toBe(result.account.userId);
      expect((await sessionOf(guest.tokens)).revoked_reason).toBe("merged");
      expect((await me(guest.tokens)).statusCode).toBe(401);
      expect((await refresh(guest.tokens.refreshToken)).statusCode).toBe(401);
      expect((await me(result.tokens)).statusCode).toBe(200);
      expect(await devicesOf(guest.account.userId)).toEqual([]);
    });

    it("drops the guest's devices and leaves the member's", async () => {
      const member = await signIn("member-phone");
      await seedDevice(member.account.userId, "member-phone");
      const guest = await newGuest();
      await seedDevice(guest.account.userId, "guest-phone");
      expect((await signIn("member-phone", guest.tokens.refreshToken)).guestMerged).toBe(true);
      expect(await devicesOf(member.account.userId)).toEqual(["member-phone"]);
    });

    it("answers a retry of a merge the same way, with a new session, and changes nothing else", async () => {
      const guest = await newGuest();
      const first = await signIn("member-twice", guest.tokens.refreshToken);
      const before = await userRow(guest.account.userId);
      const retry = await signIn("member-twice", guest.tokens.refreshToken);
      expect(retry.guestMerged).toBe(true);
      expect(retry.account).toEqual(first.account);
      expect(await userRow(guest.account.userId)).toEqual(before);
    });

    it("merges once when retries run in parallel", async () => {
      for (let round = 0; round < 5; round += 1) {
        const guest = await newGuest();
        const responses = await Promise.all([1, 2, 3].map(() => sso({ idToken: `id-member-race-${round}`, guestRefreshToken: guest.tokens.refreshToken })));
        expect(responses.map((response) => SsoResponseDtoSchema.parse(response.json()).guestMerged)).toEqual([true, true, true]);
      }
    });

    it("merges for only one member when different members race for a guest", async () => {
      for (let round = 0; round < 10; round += 1) {
        const guest = await newGuest();
        const responses = await Promise.all(
          ["a", "b", "c"].map((name) => sso({ idToken: `id-member-${name}-${round}`, guestRefreshToken: guest.tokens.refreshToken }))
        );
        expect(responses.map((response) => SsoResponseDtoSchema.parse(response.json()).guestMerged).filter(Boolean)).toHaveLength(1);
      }
    });

    it("does not merge a guest already merged into someone else", async () => {
      const guest = await newGuest();
      expect((await signIn("member-first", guest.tokens.refreshToken)).guestMerged).toBe(true);
      const before = await userRow(guest.account.userId);
      expect((await signIn("member-second", guest.tokens.refreshToken)).guestMerged).toBe(false);
      expect(await userRow(guest.account.userId)).toEqual(before);
    });

    it("never closes a member through its refresh token, its own or another member's", async () => {
      const victim = await signIn("member-victim");
      expect((await signIn("member-thief", victim.tokens.refreshToken)).guestMerged).toBe(false);
      expect((await signIn("member-victim", victim.tokens.refreshToken)).guestMerged).toBe(false);
      expect((await userRow(victim.account.userId)).deleted_at).toBeNull();
      expect((await me(victim.tokens)).statusCode).toBe(200);
    });

    it("merges with a spent guest token whose answer was lost, as refresh would accept it", async () => {
      const guest = await newGuest();
      await refreshed(guest.tokens.refreshToken);
      expect((await signIn("member-lost-answer", guest.tokens.refreshToken)).guestMerged).toBe(true);
    });

    it("does not merge with a spent guest token whose child was used, and leaves the guest", async () => {
      const guest = await newGuest();
      const next = await refreshed(guest.tokens.refreshToken);
      await refreshed(next.refreshToken);
      expect((await signIn("member-stale", guest.tokens.refreshToken)).guestMerged).toBe(false);
      expect((await userRow(guest.account.userId)).deleted_at).toBeNull();
    });

    it("does not merge a guest whose session was revoked", async () => {
      const guest = await newGuest();
      await pool.query("update sessions set revoked_at = now(), revoked_reason = 'logout' where user_id = $1", [guest.account.userId]);
      expect((await signIn("member-revoked-guest", guest.tokens.refreshToken)).guestMerged).toBe(false);
      expect((await userRow(guest.account.userId)).deleted_at).toBeNull();
    });

    it("does not merge a guest deleted some other way", async () => {
      const guest = await newGuest();
      await pool.query("update users set deleted_at = now() where id = $1", [guest.account.userId]);
      expect((await signIn("member-gone", guest.tokens.refreshToken)).guestMerged).toBe(false);
      expect((await userRow(guest.account.userId)).merged_into).toBeNull();
    });

    it.each([
      ["unknown", "x".repeat(43)],
      ["empty", ""],
      ["with spaces", "not a token"],
      ["over 4096 characters", "x".repeat(4097)]
    ])("still signs in when the guestRefreshToken is %s", async (_name, guestRefreshToken) => {
      expect((await signIn("member-bad-guest", guestRefreshToken)).guestMerged).toBe(false);
    });

    it("does not merge into a member that is already closed", async () => {
      const { account } = await signIn("closed-member");
      const guest = await newGuest();
      await pool.query("update users set deleted_at = now() where id = $1", [account.userId]);
      await expect(createPgUserRepository(pool).mergeGuest(hashRefreshToken(guest.tokens.refreshToken), account.userId as UserId)).resolves.toBe(false);
      expect((await userRow(guest.account.userId)).deleted_at).toBeNull();
    });

    it("waits for anything holding the member, and then merges nothing into a member it closed", async () => {
      const { account } = await signIn("closing-member");
      const guest = await newGuest();
      const holder = await pool.connect();
      await holder.query("begin");
      await holder.query("select 1 from users where id = $1 for update", [account.userId]);
      const merge = createPgUserRepository(pool).mergeGuest(hashRefreshToken(guest.tokens.refreshToken), account.userId as UserId);
      await expect
        .poll(async () => (await pool.query("select 1 from pg_stat_activity where wait_event_type = 'Lock' and query like '%FOR SHARE%'")).rowCount)
        .toBe(1);
      await holder.query("update users set deleted_at = now() where id = $1", [account.userId]);
      await holder.query("commit");
      holder.release();
      await expect(merge).resolves.toBe(false);
      expect((await userRow(guest.account.userId)).deleted_at).toBeNull();
    });

    it("rolls the whole merge back when a table's step fails, and the retry then works", async () => {
      const guest = await newGuest();
      await seedDevice(guest.account.userId, "kept-phone");
      const failing = await serverWith([
        ...GUEST_MERGE_STEPS,
        async () => {
          throw new Error("a table's step failed");
        }
      ]);
      const response = await sso({ idToken: "id-member-rollback", guestRefreshToken: guest.tokens.refreshToken }, failing);
      await failing.close();

      expect(response.statusCode).toBe(503);
      expect(codeOf(response)).toBe("UNAVAILABLE");
      expect(await devicesOf(guest.account.userId)).toEqual(["kept-phone"]);
      expect((await userRow(guest.account.userId)).deleted_at).toBeNull();
      expect((await me(guest.tokens)).statusCode).toBe(200);
      expect((await signIn("member-rollback", guest.tokens.refreshToken)).guestMerged).toBe(true);
    });

    it("answers 503 and keeps running when the database connection dies during a merge, and the retry works", async () => {
      const guest = await newGuest();
      const uncaught: unknown[] = [];
      const onUncaught = (error: unknown) => uncaught.push(error);
      process.on("uncaughtException", onUncaught);
      const dropping = await serverWith([(client) => client.query("select pg_terminate_backend(pg_backend_pid())")]);
      const response = await sso({ idToken: "id-member-dropped", guestRefreshToken: guest.tokens.refreshToken }, dropping);
      await dropping.close();
      // The client reports the lost socket just after the query fails.
      await new Promise((resolve) => setTimeout(resolve, 50));
      process.off("uncaughtException", onUncaught);

      expect(uncaught).toEqual([]);
      expect(response.statusCode).toBe(503);
      expect((await userRow(guest.account.userId)).deleted_at).toBeNull();
      expect((await signIn("member-dropped", guest.tokens.refreshToken)).guestMerged).toBe(true);
    });

    it("gives every connection back to the pool, whatever the outcome", async () => {
      const guest = await newGuest();
      await signIn("member-pool", guest.tokens.refreshToken);
      await signIn("member-pool", guest.tokens.refreshToken);
      await refresh(guest.tokens.refreshToken);
      await refresh("x".repeat(43));
      expect(pool.totalCount - pool.idleCount).toBe(0);
    });
  });

  describe("POST /auth/logout", () => {
    it("revokes this session only: its tokens get 401, another session of the user goes on", async () => {
      const phone = await signIn("logout-two");
      const tablet = await signIn("logout-two");
      const response = await logout(phone.tokens, { installationId: "phone" });
      expect(response.statusCode).toBe(204);
      expect(response.body).toBe("");
      expect((await me(phone.tokens)).statusCode).toBe(401);
      expect((await refresh(phone.tokens.refreshToken)).statusCode).toBe(401);
      expect((await me(tablet.tokens)).statusCode).toBe(200);
    });

    it("removes this user's row for this installation, and no other", async () => {
      const { tokens, account } = await signIn("device-owner");
      await seedDevice(account.userId, "phone");
      await seedDevice(account.userId, "tablet");
      await logout(tokens, { installationId: "phone" });
      expect(await devicesOf(account.userId)).toEqual(["tablet"]);
    });

    it("cannot remove another user's device, even with the same installation id", async () => {
      const a = await signIn("device-a");
      const b = await signIn("device-b");
      await seedDevice(a.account.userId, "shared-id");
      await seedDevice(b.account.userId, "shared-id");
      expect((await logout(b.tokens, { installationId: "shared-id" })).statusCode).toBe(204);
      expect(await devicesOf(a.account.userId)).toEqual(["shared-id"]);
      expect(await devicesOf(b.account.userId)).toEqual([]);
    });

    it.each([
      ["a path in the id", { installationId: "../x" }],
      ["no id", {}],
      ["an extra field", { installationId: "phone", userId: "user_2" }]
    ])("answers 400 to %s, and keeps the session", async (_name, body) => {
      const { tokens } = await signIn("device-bad");
      const response = await logout(tokens, body);
      expect(response.statusCode).toBe(400);
      expect(codeOf(response)).toBe("VALIDATION_ERROR");
      expect((await me(tokens)).statusCode).toBe(200);
    });

    it("refuses a guest, whose only session it would end for good, and changes nothing", async () => {
      const guest = await newGuest();
      await seedDevice(guest.account.userId, "phone");
      const response = await logout(guest.tokens, { installationId: "phone" });
      expect(response.statusCode).toBe(403);
      expect(codeOf(response)).toBe("SIGN_IN_REQUIRED");
      expect(await devicesOf(guest.account.userId)).toEqual(["phone"]);
      expect((await me(guest.tokens)).statusCode).toBe(200);
      expect(await refreshed(guest.tokens.refreshToken)).toBeDefined();
    });

    it("answers 401 with no token", async () => {
      const response = await call({ method: "POST", url: "/api/v1/auth/logout", payload: { installationId: "phone" } });
      expect(response.statusCode).toBe(401);
    });
  });

  it("never logs a token from a body or a header", async () => {
    const { server: logged, logs } = await createTestServer({ pool, auth: createRealAuth(pool) });
    const guest = GuestResponseDtoSchema.parse((await logged.inject({ method: "POST", url: "/api/v1/auth/guest" })).json());
    await logged.inject({ method: "POST", url: "/api/v1/auth/sso", payload: { idToken: "id-secret-subject", guestRefreshToken: guest.tokens.refreshToken } });
    await logged.inject({ method: "POST", url: "/api/v1/auth/sso", payload: { idToken: "secret-bad-id-token" } });
    await logged.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: "secret-unknown-refresh" } });
    await logged.inject({ method: "POST", url: "/api/v1/auth/refresh", payload: { refreshToken: guest.tokens.refreshToken } });
    await logged.inject({ url: "/api/v1/me", headers: bearer(guest.tokens) });
    await logged.close();
    for (const secret of ["secret-subject", "secret-bad-id-token", "secret-unknown-refresh", guest.tokens.refreshToken, guest.tokens.accessToken]) {
      expect(logs()).not.toContain(secret);
    }
  });

  it("deleting a user takes its sessions, tokens and devices along, and a guest merged into it survives with no pointer", async () => {
    const guest = await newGuest();
    const member = await signIn("member-leaving", guest.tokens.refreshToken);
    await seedDevice(member.account.userId, "phone");
    const id = member.account.userId as UserId;
    await pool.query("delete from users where id = $1", [id]);
    expect((await pool.query("select count(*)::int as n from devices where user_id = $1", [id])).rows[0].n).toBe(0);
    expect((await pool.query("select count(*)::int as n from sessions where user_id = $1", [id])).rows[0].n).toBe(0);
    expect((await refresh(member.tokens.refreshToken)).statusCode).toBe(401);
    const closed = await userRow(guest.account.userId);
    expect(closed.merged_into).toBeNull();
    expect(closed.deleted_at).not.toBeNull();
  });
});
