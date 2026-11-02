import { randomBytes } from "node:crypto";
import pg from "pg";

// Development-only defaults, matching docker/postgres-init.sql.
const adminUrl = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://jobflow_owner:dev-only-owner@127.0.0.1:5432/jobflow";
const APP_PASSWORD = process.env.TEST_DATABASE_APP_PASSWORD ?? "dev-only-app";

export interface TestDatabase {
  readonly appUrl: string;
  readonly ownerUrl: string;
  drop(): Promise<void>;
}

/** A new empty database, so tests in parallel files cannot see each other. Start PostgreSQL first: docker compose up -d postgres */
export async function withTestDatabase(): Promise<TestDatabase> {
  const name = `jobflow_test_${randomBytes(6).toString("hex")}`;
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const owner = new URL(adminUrl);
  owner.pathname = `/${name}`;
  const app = new URL(owner);
  app.username = "jobflow_app";
  app.password = APP_PASSWORD;

  return {
    appUrl: app.href,
    ownerUrl: owner.href,
    async drop() {
      const client = new pg.Client({ connectionString: adminUrl });
      await client.connect();
      await client.query(`DROP DATABASE ${name} WITH (FORCE)`);
      await client.end();
    }
  };
}
