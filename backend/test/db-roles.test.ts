import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool } from "../src/db/pool.js";
import { migrateUp } from "../src/db/migrate.js";
import { createServer } from "../src/server.js";
import { withTestDatabase, type TestDatabase } from "./support/database.js";
import { testConfig } from "./support/server.js";

describe("createPool", () => {
  it("gives up on a silent connection, because a server-side timeout cannot fire when packets stop", async () => {
    const pool = createPool("postgres://a:b@127.0.0.1:1/x", () => undefined);
    const { options } = pool as unknown as { options: Record<string, unknown> };
    expect(options.query_timeout).toBeGreaterThan(options.statement_timeout as number);
    expect(options.keepAlive).toBe(true);
    await pool.end();
  });
});

describe("database roles", () => {
  let database: TestDatabase;
  let app: pg.Pool;

  beforeAll(async () => {
    database = await withTestDatabase();
    await migrateUp(database.ownerUrl);
    app = new pg.Pool({ connectionString: database.appUrl });
  });
  afterAll(async () => {
    await app.end();
    await database.drop();
  });

  it("migrate applies 0001 and running it twice is a no-op", async () => {
    await migrateUp(database.ownerUrl);
    const owner = new pg.Client({ connectionString: database.ownerUrl });
    await owner.connect();
    const { rows } = await owner.query("select name from pgmigrations");
    await owner.end();
    expect(rows.map((row: { name: string }) => row.name)).toEqual(["0001_users"]);
  });

  it("the app role can read and write users", async () => {
    const inserted = await app.query("insert into users (auth_subject) values ('subject-1') returning id, created_at, deleted_at");
    expect(inserted.rows[0].id).toEqual(expect.any(String));
    expect(inserted.rows[0].deleted_at).toBeNull();
    await app.query("update users set deleted_at = now() where auth_subject = 'subject-1'");
    expect((await app.query("select count(*)::int as n from users")).rows[0].n).toBe(1);
    await app.query("delete from users");
  });

  it("users.auth_subject is unique", async () => {
    await app.query("insert into users (auth_subject) values ('subject-2')");
    await expect(app.query("insert into users (auth_subject) values ('subject-2')")).rejects.toThrow(/unique/);
    await app.query("delete from users");
  });

  it.each([
    ["create a table", "create table intruder (id int)"],
    ["drop a table", "drop table users"],
    ["alter a table", "alter table users add column intruder int"],
    ["read the migrations table", "select * from pgmigrations"]
  ])("the app role cannot %s", async (_name, statement) => {
    await expect(app.query(statement)).rejects.toThrow(/permission denied|must be owner/);
  });

  it("health answers ok against the real database with the app role", async () => {
    const pool = createPool(database.appUrl, () => undefined);
    const server = await createServer({ config: testConfig, pool });
    const response = await server.inject({ url: "/api/v1/health" });
    expect(response.json()).toEqual({ status: "ok", checks: { database: "ok" } });
    await server.close();
    await pool.end();
  });
});
