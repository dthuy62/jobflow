import { describe, expect, it } from "vitest";
import { loadConfig, loadMigrationUrl, loadWorkerConfig } from "../src/config.js";

const valid = {
  JOBFLOW_ENV: "development",
  DATABASE_URL: "postgres://jobflow_app:s3cret-value@127.0.0.1:5432/jobflow",
  FIREBASE_PROJECT_ID: "demo-jobflow",
  JWT_SIGNING_KEYS: "dev-1:dev-only-jwt-signing-key-0123456789abcdef"
};
const REAL_KEY = `k-2026:${"r".repeat(43)}`;

function messageOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error("Expected it to throw.");
}

describe("loadConfig", () => {
  it("reads a valid environment, with safe defaults", () => {
    expect(loadConfig(valid)).toEqual({
      env: "development",
      host: "127.0.0.1",
      port: 8080,
      databaseUrl: valid.DATABASE_URL,
      firebaseProjectId: "demo-jobflow",
      jwtSigningKeys: [{ kid: "dev-1", secret: "dev-only-jwt-signing-key-0123456789abcdef" }],
      trustProxyHops: 0
    });
  });

  it.each(["JOBFLOW_ENV", "DATABASE_URL", "FIREBASE_PROJECT_ID", "JWT_SIGNING_KEYS"])("names a missing %s in the error", (name) => {
    const env: Record<string, string> = { ...valid };
    delete env[name];
    expect(messageOf(() => loadConfig(env))).toContain(name);
  });

  it("never includes a value in the error", () => {
    const message = messageOf(() => loadConfig({ ...valid, PORT: "not-a-port-s3cret", JOBFLOW_ENV: "s3cret-env" }));
    expect(message).toContain("PORT");
    expect(message).not.toContain("s3cret");
  });

  it.each(["0", "65536", "80a", ""])("rejects PORT=%j", (PORT) => {
    expect(messageOf(() => loadConfig({ ...valid, PORT }))).toContain("PORT");
  });

  it.each(["true", "yes", "-1", "1.5", ""])("rejects TRUST_PROXY=%j", (TRUST_PROXY) => {
    expect(messageOf(() => loadConfig({ ...valid, TRUST_PROXY }))).toContain("TRUST_PROXY");
  });

  it("reads a hop count for TRUST_PROXY", () => {
    expect(loadConfig({ ...valid, TRUST_PROXY: "2" }).trustProxyHops).toBe(2);
  });

  it("refuses the development passwords in production, without printing them", () => {
    const message = messageOf(() =>
      loadConfig({ ...valid, JOBFLOW_ENV: "production", DATABASE_URL: "postgres://jobflow_app:dev-only-app@db/jobflow" })
    );
    expect(message).toContain("DATABASE_URL");
    expect(message).not.toContain("dev-only-app");
  });

  it.each(["postgres://jobflow_app@db/jobflow?password=dev-only-app", "postgres://jobflow_app:dev%2Donly-app@db/jobflow"])(
    "reads the password the way the driver does: %s",
    (DATABASE_URL) => {
      expect(messageOf(() => loadConfig({ ...valid, JOBFLOW_ENV: "production", DATABASE_URL }))).toContain("DATABASE_URL");
    }
  );

  it.each(["garbage", "http://db/jobflow", "postgres:"])("rejects DATABASE_URL=%s, which would only fail later with a confusing error", (DATABASE_URL) => {
    expect(messageOf(() => loadConfig({ ...valid, DATABASE_URL }))).toContain("DATABASE_URL");
  });

  it("refuses the development Firebase project in production", () => {
    expect(messageOf(() => loadConfig({ ...valid, JOBFLOW_ENV: "production", FIREBASE_PROJECT_ID: "demo-jobflow" }))).toContain("FIREBASE_PROJECT_ID");
    expect(loadConfig({ ...valid, JOBFLOW_ENV: "production", FIREBASE_PROJECT_ID: "jobflow-prod", JWT_SIGNING_KEYS: REAL_KEY }).firebaseProjectId).toBe("jobflow-prod");
  });

  it("refuses a development signing key in production, also one that only verifies, without printing it", () => {
    for (const JWT_SIGNING_KEYS of [valid.JWT_SIGNING_KEYS, `${REAL_KEY},${valid.JWT_SIGNING_KEYS}`]) {
      const message = messageOf(() => loadConfig({ ...valid, JOBFLOW_ENV: "production", FIREBASE_PROJECT_ID: "jobflow-prod", JWT_SIGNING_KEYS }));
      expect(message).toContain("JWT_SIGNING_KEYS");
      expect(message).not.toContain("dev-only-jwt");
    }
  });

  it("reads several keys in order: the first signs, all verify", () => {
    const keys = loadConfig({ ...valid, JWT_SIGNING_KEYS: `new:${"n".repeat(32)},old:${"o".repeat(40)}` }).jwtSigningKeys;
    expect(keys).toEqual([
      { kid: "new", secret: "n".repeat(32) },
      { kid: "old", secret: "o".repeat(40) }
    ]);
  });

  it.each([
    ["a secret under 32 characters", `k:${"s".repeat(31)}`],
    ["no kid", `:${"s".repeat(32)}`],
    ["no separator", "s".repeat(40)],
    ["a kid with a space", `k 1:${"s".repeat(32)}`],
    ["a repeated kid", `k:${"a".repeat(32)},k:${"b".repeat(32)}`],
    ["an empty pair", `k:${"a".repeat(32)},`],
    ["nothing", ""]
  ])("rejects JWT_SIGNING_KEYS with %s, without printing it", (_name, JWT_SIGNING_KEYS) => {
    const message = messageOf(() => loadConfig({ ...valid, JWT_SIGNING_KEYS }));
    expect(message).toContain("JWT_SIGNING_KEYS");
    expect(message).not.toMatch(/sss|aaa|bbb/);
  });

  it("looks only at the password, so a host name holding the marker is fine", () => {
    expect(() =>
      loadConfig({ ...valid, JOBFLOW_ENV: "production", FIREBASE_PROJECT_ID: "jobflow-prod", JWT_SIGNING_KEYS: REAL_KEY, DATABASE_URL: "postgres://app:real-password@dev-only-replica.internal/x" })
    ).not.toThrow();
  });

  it("accepts the development passwords outside production", () => {
    expect(() => loadConfig({ ...valid, DATABASE_URL: "postgres://jobflow_app:dev-only-app@db/jobflow" })).not.toThrow();
  });
});

describe("loadMigrationUrl", () => {
  it("reads DATABASE_MIGRATION_URL", () => {
    expect(loadMigrationUrl({ JOBFLOW_ENV: "development", DATABASE_MIGRATION_URL: "postgres://o:p@db/x" })).toBe("postgres://o:p@db/x");
  });

  it("refuses the owner's development password in production, without printing it", () => {
    const message = messageOf(() =>
      loadMigrationUrl({ JOBFLOW_ENV: "production", DATABASE_MIGRATION_URL: "postgres://jobflow_owner:dev-only-owner@db/x" })
    );
    expect(message).toContain("DATABASE_MIGRATION_URL");
    expect(message).not.toContain("dev-only-owner");
  });

  it("names it when missing", () => {
    expect(messageOf(() => loadMigrationUrl({ JOBFLOW_ENV: "development" }))).toContain("DATABASE_MIGRATION_URL");
  });

  it.each([undefined, "Production", "prod"])("requires a valid JOBFLOW_ENV, so the production check cannot silently turn off: %s", (JOBFLOW_ENV) => {
    expect(messageOf(() => loadMigrationUrl({ JOBFLOW_ENV, DATABASE_MIGRATION_URL: "postgres://o:dev-only-owner@db/x" }))).toContain("JOBFLOW_ENV");
  });

  it("rejects a value that is not a PostgreSQL URL, without printing it", () => {
    const message = messageOf(() => loadMigrationUrl({ JOBFLOW_ENV: "development", DATABASE_MIGRATION_URL: "garbage-s3cret" }));
    expect(message).toContain("DATABASE_MIGRATION_URL");
    expect(message).not.toContain("s3cret");
  });
});

describe("loadWorkerConfig", () => {
  it("reads the app role's URL, and needs no Firebase project", () => {
    expect(loadWorkerConfig({ JOBFLOW_ENV: "development", DATABASE_URL: "postgres://a:b@db/x" })).toEqual({ databaseUrl: "postgres://a:b@db/x" });
  });

  it.each([
    [{ DATABASE_URL: "postgres://a:b@db/x" }, "JOBFLOW_ENV"],
    [{ JOBFLOW_ENV: "development" }, "DATABASE_URL"],
    [{ JOBFLOW_ENV: "development", DATABASE_URL: "garbage" }, "DATABASE_URL"],
    [{ JOBFLOW_ENV: "production", DATABASE_URL: "postgres://a:dev-only-app@db/x" }, "DATABASE_URL"]
  ])("rejects %j", (env, name) => {
    expect(messageOf(() => loadWorkerConfig(env))).toContain(name);
  });
});
