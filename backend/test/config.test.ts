import { describe, expect, it } from "vitest";
import { loadConfig, loadMigrationUrl } from "../src/config.js";

const valid = {
  JOBFLOW_ENV: "development",
  DATABASE_URL: "postgres://jobflow_app:s3cret-value@127.0.0.1:5432/jobflow",
  FIREBASE_PROJECT_ID: "demo-jobflow"
};

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
      trustProxyHops: 0
    });
  });

  it.each(["JOBFLOW_ENV", "DATABASE_URL", "FIREBASE_PROJECT_ID"])("names a missing %s in the error", (name) => {
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

  it("looks only at the password, so a host name holding the marker is fine", () => {
    expect(() =>
      loadConfig({ ...valid, JOBFLOW_ENV: "production", DATABASE_URL: "postgres://app:real-password@dev-only-replica.internal/x" })
    ).not.toThrow();
  });

  it("accepts the development passwords outside production", () => {
    expect(() => loadConfig({ ...valid, DATABASE_URL: "postgres://jobflow_app:dev-only-app@db/jobflow" })).not.toThrow();
  });
});

describe("loadMigrationUrl", () => {
  it("reads DATABASE_MIGRATION_URL", () => {
    expect(loadMigrationUrl({ DATABASE_MIGRATION_URL: "postgres://o:p@db/x" })).toBe("postgres://o:p@db/x");
  });

  it("refuses the owner's development password in production, without printing it", () => {
    const message = messageOf(() =>
      loadMigrationUrl({ JOBFLOW_ENV: "production", DATABASE_MIGRATION_URL: "postgres://jobflow_owner:dev-only-owner@db/x" })
    );
    expect(message).toContain("DATABASE_MIGRATION_URL");
    expect(message).not.toContain("dev-only-owner");
  });

  it("names it when missing", () => {
    expect(messageOf(() => loadMigrationUrl({}))).toContain("DATABASE_MIGRATION_URL");
  });
});
