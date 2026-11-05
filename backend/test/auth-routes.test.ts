import { ErrorResponseDtoSchema, MeDtoSchema, SsoResponseDtoSchema } from "@jobflow/contract";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOidcAuthVerifier } from "../src/adapters/oidc-auth-verifier.js";
import { createPgDeviceRepository } from "../src/adapters/pg-device-repository.js";
import { createPgUserRepository, GUEST_MERGE_STEPS, type GuestMergeStep } from "../src/adapters/pg-user-repository.js";
import { AuthUnavailableError } from "../src/core/identity.js";
import type { AuthVerifier } from "../src/core/ports.js";
import { migrateUp } from "../src/db/migrate.js";
import { createPool } from "../src/db/pool.js";
import { createServer } from "../src/server.js";
import { withTestDatabase, type TestDatabase } from "./support/database.js";
import { asUser, createTestServer, stubAuthVerifier, testConfig } from "./support/server.js";

/**
 * On top of the stub: `stale-<name>` is an anonymous token for the subject of `test-<name>`, as
 * when Firebase linked that user after issuing it. `outage-<name>` cannot be checked.
 */
const authVerifier: AuthVerifier = {
  async verify(token) {
    if (token.startsWith("stale-")) return { subject: `test-${token.slice("stale-".length)}`, isAnonymous: true };
    if (token.startsWith("outage-")) throw new AuthUnavailableError(new Error("keys are down"));
    return stubAuthVerifier.verify(token);
  }
};

describe("the auth routes, with real PostgreSQL and the app role", () => {
  let database: TestDatabase;
  let pool: pg.Pool;
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeAll(async () => {
    database = await withTestDatabase();
    await migrateUp(database.ownerUrl);
    pool = createPool(database.appUrl, () => undefined);
    server = await serverWith(authVerifier);
  });
  afterAll(async () => {
    await server.close();
    await pool.end();
    await database.drop();
  });

  const serverWith = (verifier: AuthVerifier, steps: readonly GuestMergeStep[] = GUEST_MERGE_STEPS) =>
    createServer({
      config: testConfig,
      pool,
      authVerifier: verifier,
      users: createPgUserRepository(pool, steps),
      devices: createPgDeviceRepository(pool)
    });

  const me = (name: string) => server.inject({ url: "/api/v1/me", headers: asUser(name) });
  const guest = (name: string) => server.inject({ method: "POST", url: "/api/v1/auth/guest", headers: asUser(name) });
  const sso = (name: string, body: unknown = {}, target = server) =>
    target.inject({ method: "POST", url: "/api/v1/auth/sso", headers: asUser(name), payload: body as object });
  const logout = (name: string, body: unknown) => server.inject({ method: "POST", url: "/api/v1/auth/logout", headers: asUser(name), payload: body as object });

  const userRow = async (name: string) =>
    (await pool.query("select id, deleted_at, linked_at, merged_into, xmin::text as version from users where auth_subject = $1", [`test-${name}`])).rows[0];
  const seedDevice = async (name: string, installationId: string) => {
    await me(name);
    const { id } = await userRow(name);
    await pool.query("insert into devices (user_id, installation_id, fcm_token) values ($1, $2, 'synthetic-fcm')", [id, installationId]);
  };
  const devicesOf = async (name: string) => {
    const { id } = await userRow(name);
    return (await pool.query("select installation_id from devices where user_id = $1 order by 1", [id])).rows.map((row) => row.installation_id);
  };
  const codeOf = (response: { json(): unknown }) => ErrorResponseDtoSchema.parse(response.json()).error.code;
  const merged = (response: { statusCode: number; json(): unknown }) => {
    expect(response.statusCode).toBe(200);
    return SsoResponseDtoSchema.parse(response.json()).guestMerged;
  };

  describe("POST /auth/guest", () => {
    it("creates the user for an anonymous token and returns the account", async () => {
      const response = await guest("anon-new");
      expect(response.statusCode).toBe(200);
      expect(MeDtoSchema.parse(response.json()).isAnonymous).toBe(true);
    });

    it("gives the same account on a retry, and writes nothing", async () => {
      const first = (await guest("anon-retry")).json();
      const { version } = await userRow("anon-retry");
      expect((await guest("anon-retry")).json()).toEqual(first);
      expect((await userRow("anon-retry")).version).toBe(version);
    });

    it("gives the account the safety net already created", async () => {
      const account = (await me("anon-early")).json();
      expect((await guest("anon-early")).json()).toEqual(account);
    });

    it("refuses a token that is not anonymous, with no 401 that would sign the app out", async () => {
      const response = await guest("member-at-guest");
      expect(response.statusCode).toBe(409);
      expect(codeOf(response)).toBe("CONFLICT");
    });
  });

  describe("POST /auth/sso", () => {
    it("creates the target user and reports no merge when there is no guestToken", async () => {
      const response = await sso("member-new");
      expect(merged(response)).toBe(false);
      const { account } = SsoResponseDtoSchema.parse(response.json());
      expect(account.isAnonymous).toBe(false);
      expect(account.userId).toBe((await userRow("member-new")).id);
    });

    it("gives the same account on a retry, and writes nothing", async () => {
      const first = (await sso("member-retry")).json();
      const { version } = await userRow("member-retry");
      expect((await sso("member-retry")).json()).toEqual(first);
      expect((await userRow("member-retry")).version).toBe(version);
    });

    it("refuses an anonymous token, and does not read the body first", async () => {
      const response = await sso("anon-at-sso", { guestToken: "test-anon-other" });
      expect(response.statusCode).toBe(403);
      expect(codeOf(response)).toBe("SIGN_IN_REQUIRED");
      expect(await userRow("anon-other")).toBeUndefined();
    });

    it("takes the target only from the Bearer token: a body cannot name one", async () => {
      await me("victim");
      const response = await sso("attacker", { userId: (await userRow("victim")).id });
      expect(response.statusCode).toBe(400);
      expect(codeOf(response)).toBe("VALIDATION_ERROR");
    });

    it("merges a guest: closes it, and its token then gets 401", async () => {
      await me("anon-merge");
      expect(merged(await sso("member-merge", { guestToken: "test-anon-merge" }))).toBe(true);
      const row = await userRow("anon-merge");
      expect(row.deleted_at).not.toBeNull();
      expect(row.merged_into).toBe((await userRow("member-merge")).id);
      expect((await me("anon-merge")).statusCode).toBe(401);
      expect((await guest("anon-merge")).statusCode).toBe(401);
      expect((await me("member-merge")).statusCode).toBe(200);
    });

    it("answers a retry of a merge the same way, and changes nothing", async () => {
      await me("anon-twice");
      expect(merged(await sso("member-twice", { guestToken: "test-anon-twice" }))).toBe(true);
      const before = await userRow("anon-twice");
      expect(merged(await sso("member-twice", { guestToken: "test-anon-twice" }))).toBe(true);
      expect(await userRow("anon-twice")).toEqual(before);
    });

    it("merges once when retries run in parallel", async () => {
      for (let round = 0; round < 5; round += 1) {
        await me(`anon-race-${round}`);
        const responses = await Promise.all([1, 2, 3].map(() => sso(`member-race-${round}`, { guestToken: `test-anon-race-${round}` })));
        expect(responses.map(merged)).toEqual([true, true, true]);
      }
    });

    it("merges for only one member when different members race for a guest", async () => {
      for (let round = 0; round < 10; round += 1) {
        await me(`anon-contested-${round}`);
        const responses = await Promise.all(["a", "b", "c"].map((name) => sso(`member-${name}-${round}`, { guestToken: `test-anon-contested-${round}` })));
        expect(responses.map(merged).filter(Boolean)).toHaveLength(1);
      }
    });

    it("has nothing to merge from a guest the server never saw, and creates no row for it", async () => {
      expect(merged(await sso("member-early", { guestToken: "test-anon-unseen" }))).toBe(false);
      expect(await userRow("anon-unseen")).toBeUndefined();
    });

    it("does not close an account the server never saw, through its anonymous token from before Firebase linked it", async () => {
      expect(merged(await sso("thief-early", { guestToken: "stale-unseen-account" }))).toBe(false);
      expect((await me("unseen-account")).statusCode).toBe(200);
    });

    it("does not merge a guest already merged into someone else", async () => {
      await me("anon-taken");
      expect(merged(await sso("member-first", { guestToken: "test-anon-taken" }))).toBe(true);
      const before = await userRow("anon-taken");
      expect(merged(await sso("member-second", { guestToken: "test-anon-taken" }))).toBe(false);
      expect(await userRow("anon-taken")).toEqual(before);
    });

    it("does not merge a guest deleted some other way", async () => {
      await me("anon-gone");
      await pool.query("update users set deleted_at = now() where auth_subject = 'test-anon-gone'");
      expect(merged(await sso("member-gone", { guestToken: "test-anon-gone" }))).toBe(false);
      expect((await userRow("anon-gone")).merged_into).toBeNull();
    });

    it("does not merge a user into itself: Firebase linked it, so the data is already there", async () => {
      await me("linked");
      expect(merged(await sso("linked", { guestToken: "stale-linked" }))).toBe(false);
      const row = await userRow("linked");
      expect(row.deleted_at).toBeNull();
      expect(row.merged_into).toBeNull();
      expect((await me("linked")).statusCode).toBe(200);
    });

    it("does not close a member through an anonymous token from before Firebase linked it", async () => {
      await sso("real-account");
      expect(merged(await sso("thief", { guestToken: "stale-real-account" }))).toBe(false);
      expect((await userRow("real-account")).deleted_at).toBeNull();
      expect((await me("real-account")).statusCode).toBe(200);
    });

    it("protects a member whose /auth/sso failed, once any route has seen their real token", async () => {
      await server.inject({ url: "/api/v1/me", headers: { authorization: "Bearer stale-safety-net" } });
      expect((await userRow("safety-net")).linked_at).toBeNull();
      await me("safety-net");
      const { linked_at: linkedAt, version } = await userRow("safety-net");
      expect(linkedAt).not.toBeNull();

      expect(merged(await sso("thief-net", { guestToken: "stale-safety-net" }))).toBe(false);
      expect((await me("safety-net")).statusCode).toBe(200);
      expect((await userRow("safety-net")).version).toBe(version);
    });

    it("does not merge a token that is not anonymous, and does not touch that member", async () => {
      await me("other-member");
      expect(merged(await sso("member-wrong-kind", { guestToken: "test-other-member" }))).toBe(false);
      expect((await userRow("other-member")).deleted_at).toBeNull();
    });

    it.each([
      ["signed by no one", "garbage"],
      ["with spaces", "not a token"],
      ["empty", ""],
      ["over 4096 characters", "x".repeat(4097)]
    ])("still signs in when the guestToken is %s", async (_name, guestToken) => {
      const response = await sso("member-bad-token", { guestToken });
      expect(merged(response)).toBe(false);
    });

    it("answers 400 to a guestToken that is not a string", async () => {
      const response = await sso("member-bad-type", { guestToken: 1 });
      expect(response.statusCode).toBe(400);
    });

    it("answers 503, not a false 'no merge', when the guestToken cannot be checked, so the app retries", async () => {
      await me("anon-outage");
      const response = await sso("member-outage", { guestToken: "outage-anon-outage" });
      expect(response.statusCode).toBe(503);
      expect(codeOf(response)).toBe("AUTH_UNAVAILABLE");
      expect((await me("anon-outage")).statusCode).toBe(200);
    });

    it("with a real verifier, an expired guest token signs in without merging; a fresh one merges", async () => {
      const { privateKey, publicKey } = await generateKeyPair("RS256");
      const issuer = "https://issuer.example";
      const real = createOidcAuthVerifier({
        issuer,
        audience: "aud",
        keys: createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: "key-1", alg: "RS256", use: "sig" }] }),
        isAnonymous: (payload) => payload.anonymous === true
      });
      const sign = (subject: string, anonymous: boolean, exp: number) =>
        new SignJWT({ anonymous })
          .setProtectedHeader({ alg: "RS256", kid: "key-1" })
          .setIssuer(issuer)
          .setAudience("aud")
          .setSubject(subject)
          .setIssuedAt(exp - 3600)
          .setExpirationTime(exp)
          .sign(privateKey);
      const now = Math.floor(Date.now() / 1000);
      const realServer = await serverWith(real);
      const call = async (guestToken: string) =>
        realServer.inject({
          method: "POST",
          url: "/api/v1/auth/sso",
          headers: { authorization: `Bearer ${await sign("real-member", false, now + 3600)}` },
          payload: { guestToken }
        });

      await realServer.inject({ url: "/api/v1/me", headers: { authorization: `Bearer ${await sign("real-guest", true, now + 3600)}` } });
      expect(merged(await call(await sign("real-guest", true, now - 3600)))).toBe(false);
      expect(merged(await call(await sign("real-guest", true, now + 3600)))).toBe(true);
      await realServer.close();
    });

    it("drops the guest's devices and leaves the member's", async () => {
      await seedDevice("anon-phone", "guest-phone");
      await seedDevice("member-phone", "member-phone");
      expect(merged(await sso("member-phone", { guestToken: "test-anon-phone" }))).toBe(true);
      expect(await devicesOf("anon-phone")).toEqual([]);
      expect(await devicesOf("member-phone")).toEqual(["member-phone"]);
    });

    it("rolls the whole merge back when a table's step fails, and the retry then works", async () => {
      await seedDevice("anon-rollback", "kept-phone");
      await sso("member-rollback");
      const failing = await serverWith(authVerifier, [
        ...GUEST_MERGE_STEPS,
        async () => {
          throw new Error("a table's step failed");
        }
      ]);
      const response = await sso("member-rollback", { guestToken: "test-anon-rollback" }, failing);
      await failing.close();

      expect(response.statusCode).toBe(503);
      expect(codeOf(response)).toBe("UNAVAILABLE");
      expect(await devicesOf("anon-rollback")).toEqual(["kept-phone"]);
      expect((await userRow("anon-rollback")).deleted_at).toBeNull();
      expect((await me("anon-rollback")).statusCode).toBe(200);
      expect(merged(await sso("member-rollback", { guestToken: "test-anon-rollback" }))).toBe(true);
    });

    it("answers 503 and keeps running when the database connection dies during a merge, and the retry works", async () => {
      await me("anon-dropped");
      const dropping = await serverWith(authVerifier, [(client) => client.query("select pg_terminate_backend(pg_backend_pid())")]);
      const response = await sso("member-dropped", { guestToken: "test-anon-dropped" }, dropping);
      await dropping.close();

      expect(response.statusCode).toBe(503);
      expect((await userRow("anon-dropped")).deleted_at).toBeNull();
      expect(merged(await sso("member-dropped", { guestToken: "test-anon-dropped" }))).toBe(true);
    });

    it("gives every connection back to the pool, whatever the outcome", async () => {
      await me("anon-pool");
      await sso("member-pool", { guestToken: "test-anon-pool" });
      await sso("member-pool", { guestToken: "test-anon-pool" });
      expect(pool.totalCount - pool.idleCount).toBe(0);
    });
  });

  describe("POST /auth/logout", () => {
    it("removes this user's row for this installation, and no other", async () => {
      await seedDevice("device-owner", "phone");
      await seedDevice("device-owner", "tablet");
      const response = await logout("device-owner", { installationId: "phone" });
      expect(response.statusCode).toBe(204);
      expect(response.body).toBe("");
      expect(await devicesOf("device-owner")).toEqual(["tablet"]);
    });

    it("cannot remove another user's device, even with the same installation id", async () => {
      await seedDevice("device-a", "shared-id");
      await seedDevice("device-b", "shared-id");
      expect((await logout("device-b", { installationId: "shared-id" })).statusCode).toBe(204);
      expect(await devicesOf("device-a")).toEqual(["shared-id"]);
      expect(await devicesOf("device-b")).toEqual([]);
    });

    it("answers the same on a retry and for an id never registered", async () => {
      await seedDevice("device-retry", "phone");
      expect((await logout("device-retry", { installationId: "phone" })).statusCode).toBe(204);
      expect((await logout("device-retry", { installationId: "phone" })).statusCode).toBe(204);
      expect((await logout("device-retry", { installationId: "never-seen" })).statusCode).toBe(204);
    });

    it("works for a guest too", async () => {
      await seedDevice("anon-device", "phone");
      expect((await logout("anon-device", { installationId: "phone" })).statusCode).toBe(204);
      expect(await devicesOf("anon-device")).toEqual([]);
    });

    it.each([
      ["a path in the id", { installationId: "../x" }],
      ["no id", {}],
      ["an extra field", { installationId: "phone", userId: "user_2" }]
    ])("answers 400 to %s", async (_name, body) => {
      const response = await logout("device-bad", body);
      expect(response.statusCode).toBe(400);
      expect(codeOf(response)).toBe("VALIDATION_ERROR");
    });

    it("answers 401 with no token", async () => {
      const response = await server.inject({ method: "POST", url: "/api/v1/auth/logout", payload: { installationId: "phone" } });
      expect(response.statusCode).toBe(401);
    });
  });

  it("never logs a guest token", async () => {
    const { server: logged, logs } = await createTestServer();
    await logged.inject({ method: "POST", url: "/api/v1/auth/sso", headers: asUser("member-logs"), payload: { guestToken: "test-anon-secret-in-body" } });
    await logged.close();
    expect(logs()).not.toContain("secret-in-body");
  });

  it("deleting a user takes its devices along, and a guest merged into it survives with no pointer", async () => {
    await seedDevice("member-leaving", "phone");
    await me("anon-of-leaving");
    await sso("member-leaving", { guestToken: "test-anon-of-leaving" });
    const { id } = await userRow("member-leaving");
    await pool.query("delete from users where id = $1", [id]);
    expect((await pool.query("select count(*)::int as n from devices where user_id = $1", [id])).rows[0].n).toBe(0);
    const closed = await userRow("anon-of-leaving");
    expect(closed.merged_into).toBeNull();
    expect(closed.deleted_at).not.toBeNull();
  });
});
