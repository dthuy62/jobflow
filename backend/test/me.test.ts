import { MeDtoSchema } from "@jobflow/contract";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPgUserRepository } from "../src/adapters/pg-user-repository.js";
import { migrateUp } from "../src/db/migrate.js";
import { createPool } from "../src/db/pool.js";
import { createServer } from "../src/server.js";
import { withTestDatabase, type TestDatabase } from "./support/database.js";
import { asUser, stubAuthVerifier, testConfig } from "./support/server.js";

describe("GET /api/v1/me, with real PostgreSQL and the app role", () => {
  let database: TestDatabase;
  let pool: pg.Pool;
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeAll(async () => {
    database = await withTestDatabase();
    await migrateUp(database.ownerUrl);
    pool = createPool(database.appUrl, () => undefined);
    server = await createServer({ config: testConfig, pool, authVerifier: stubAuthVerifier, users: createPgUserRepository(pool) });
  });
  afterAll(async () => {
    await server.close();
    await pool.end();
    await database.drop();
  });

  const me = (subject: string) => server.inject({ url: "/api/v1/me", headers: asUser(subject) });
  const count = async (subject: string) =>
    (await pool.query("select count(*)::int as n from users where auth_subject = $1", [`test-${subject}`])).rows[0].n as number;

  it("creates the user on first call and returns the same userId afterwards", async () => {
    const first = await me("first");
    expect(first.statusCode).toBe(200);
    const body = MeDtoSchema.parse(first.json());
    expect(MeDtoSchema.parse((await me("first")).json())).toEqual(body);
    expect(await count("first")).toBe(1);
  });

  it("does not write on a known user's request, which would bloat the table", async () => {
    await me("quiet");
    const before = (await pool.query("select xmin::text from users where auth_subject = 'test-quiet'")).rows[0].xmin;
    await me("quiet");
    expect((await pool.query("select xmin::text from users where auth_subject = 'test-quiet'")).rows[0].xmin).toBe(before);
  });

  it("anonymous and signed-in tokens report isAnonymous correctly", async () => {
    expect((await me("anon-person")).json().isAnonymous).toBe(true);
    expect((await me("person")).json().isAnonymous).toBe(false);
  });

  it("returns only the caller's user", async () => {
    const one = (await me("one")).json();
    const two = (await me("two")).json();
    expect(one.userId).not.toBe(two.userId);
  });

  it("ignores a user id in the request", async () => {
    const one = (await me("self")).json();
    const other = (await me("someone-else")).json();
    const response = await server.inject({ url: `/api/v1/me?userId=${other.userId}`, headers: { ...asUser("self"), "x-user-id": other.userId } });
    expect(response.json().userId).toBe(one.userId);
  });

  it("a deleted user gets 401, and the row is not revived", async () => {
    await me("leaving");
    await pool.query("update users set deleted_at = now() where auth_subject = 'test-leaving'");
    const before = (await pool.query("select deleted_at from users where auth_subject = 'test-leaving'")).rows[0].deleted_at;
    expect((await me("leaving")).statusCode).toBe(401);
    expect((await pool.query("select deleted_at from users where auth_subject = 'test-leaving'")).rows[0].deleted_at).toEqual(before);
    expect(await count("leaving")).toBe(1);
  });

  it("two parallel first calls create one row and both succeed", async () => {
    for (let round = 0; round < 10; round += 1) {
      const responses = await Promise.all([me(`race-${round}`), me(`race-${round}`), me(`race-${round}`)]);
      expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 200]);
      expect(new Set(responses.map((response) => response.json().userId)).size).toBe(1);
      expect(await count(`race-${round}`)).toBe(1);
    }
  });
});
