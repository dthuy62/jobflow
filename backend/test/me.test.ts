import { GuestResponseDtoSchema, MeDtoSchema, SsoResponseDtoSchema } from "@jobflow/contract";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrateUp } from "../src/db/migrate.js";
import { createPool } from "../src/db/pool.js";
import { createServer } from "../src/server.js";
import { withTestDatabase, type TestDatabase } from "./support/database.js";
import { createRealAuth, testConfig } from "./support/server.js";

describe("GET /api/v1/me, with real PostgreSQL and the app role", () => {
  let database: TestDatabase;
  let pool: pg.Pool;
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeAll(async () => {
    database = await withTestDatabase();
    await migrateUp(database.ownerUrl);
    pool = createPool(database.appUrl, () => undefined);
    server = await createServer({ config: testConfig, pool, auth: createRealAuth(pool) });
  });
  afterAll(async () => {
    await server.close();
    await pool.end();
    await database.drop();
  });

  const bearer = (accessToken: string) => ({ authorization: `Bearer ${accessToken}` });
  const newGuest = async () => GuestResponseDtoSchema.parse((await server.inject({ method: "POST", url: "/api/v1/auth/guest" })).json());
  const signIn = async (subject: string) =>
    SsoResponseDtoSchema.parse((await server.inject({ method: "POST", url: "/api/v1/auth/sso", payload: { idToken: `id-${subject}` } })).json());
  const me = (accessToken: string, extra: Record<string, string> = {}, url = "/api/v1/me") => server.inject({ url, headers: { ...bearer(accessToken), ...extra } });

  it("returns a guest's account, the same as when it was created", async () => {
    const { tokens, account } = await newGuest();
    const response = await me(tokens.accessToken);
    expect(response.statusCode).toBe(200);
    expect(MeDtoSchema.parse(response.json())).toEqual(account);
    expect(account.isAnonymous).toBe(true);
  });

  it("returns a member's account, not anonymous", async () => {
    const { tokens, account } = await signIn("me-member");
    expect(MeDtoSchema.parse((await me(tokens.accessToken)).json())).toEqual({ ...account, isAnonymous: false });
  });

  it("ignores a user id in the request", async () => {
    const one = await newGuest();
    const other = await newGuest();
    const response = await me(one.tokens.accessToken, { "x-user-id": other.account.userId }, `/api/v1/me?userId=${other.account.userId}`);
    expect(response.json().userId).toBe(one.account.userId);
  });

  it("a deleted user gets 401, and a request writes nothing", async () => {
    const { tokens, account } = await signIn("me-leaving");
    await pool.query("update users set deleted_at = now() where id = $1", [account.userId]);
    const version = async () => (await pool.query("select xmin::text from users where id = $1", [account.userId])).rows[0].xmin;
    const before = await version();
    expect((await me(tokens.accessToken)).statusCode).toBe(401);
    expect(await version()).toBe(before);
  });
});
