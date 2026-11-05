import { describe, expect, it } from "vitest";
import { parseCliArgs, parsePort } from "../src/config/cli-args.js";
import { loadEnvConfig } from "../src/config/env.js";
import { loadRuntimeConfig } from "../src/config/runtime-config.js";
import { isPairingTokenRequiredForHost } from "../src/security/local-pairing-token.js";

describe("runtime configuration parsing", () => {
  it("accepts valid port values", () => {
    expect(parsePort("1", "--port")).toBe(1);
    expect(parsePort("3000", "--port")).toBe(3000);
    expect(parsePort("65535", "--port")).toBe(65535);
  });

  it.each(["abc", "3000abc", "-1", "0", "65536", "30.5"])(
    "rejects invalid port value %s",
    (value) => {
      expect(() => parsePort(value, "--port")).toThrow(
        "--port must be an integer between 1 and 65535."
      );
    }
  );

  it("validates CLI and env ports before building runtime config", () => {
    expect(parseCliArgs(["--port", "3000"]).port).toBe(3000);
    expect(() => parseCliArgs(["--port", "3000abc"])).toThrow();
    expect(loadEnvConfig({ CAREER_OPS_PORT: "3001" }).port).toBe(3001);
    expect(() => loadEnvConfig({ CAREER_OPS_PORT: "abc" })).toThrow();
  });

  it.each(["--host", "--port", "--workspace"])(
    "rejects missing CLI value for %s",
    (flag) => {
      expect(() => parseCliArgs([flag])).toThrow(`${flag} requires a value.`);
      expect(() => parseCliArgs([flag, "--port"])).toThrow(`${flag} requires a value.`);
    }
  );

  it("loads and validates the scan timeout from env", () => {
    expect(loadEnvConfig({ CAREER_OPS_SCAN_TIMEOUT_MS: "120000" }).scanTimeoutMs).toBe(120000);
    expect(loadRuntimeConfig({ argv: [], env: { CAREER_OPS_SCAN_TIMEOUT_MS: "5000" } }).scanTimeoutMs).toBe(5000);
    expect(loadRuntimeConfig({ argv: [], env: {} }).scanTimeoutMs).toBeUndefined();
    expect(() => loadEnvConfig({ CAREER_OPS_SCAN_TIMEOUT_MS: "10" })).toThrow();
    expect(() => loadEnvConfig({ CAREER_OPS_SCAN_TIMEOUT_MS: "1e4" })).toThrow();
  });

  it("loads evaluation settings only when a provider is configured", () => {
    expect(loadRuntimeConfig({ argv: [], env: {} }).evaluation).toBeUndefined();
    expect(
      loadRuntimeConfig({ argv: [], env: { CAREER_OPS_EVALUATION_TIMEOUT_MS: "120000" } }).evaluation
    ).toBeUndefined();
    expect(loadRuntimeConfig({ argv: [], env: { CAREER_OPS_EVALUATION_PROVIDER: "claude" } }).evaluation).toEqual({
      provider: "claude",
      timeoutMs: 900000
    });
    expect(
      loadRuntimeConfig({
        argv: [],
        env: {
          CAREER_OPS_EVALUATION_PROVIDER: "claude",
          CAREER_OPS_EVALUATION_TIMEOUT_MS: "60000",
          CAREER_OPS_EVALUATION_CLI: "/opt/bin/claude"
        }
      }).evaluation
    ).toEqual({ provider: "claude", timeoutMs: 60000, cliPath: "/opt/bin/claude" });
  });

  it("rejects invalid evaluation settings", () => {
    expect(() => loadEnvConfig({ CAREER_OPS_EVALUATION_PROVIDER: "gemini" })).toThrow(
      'CAREER_OPS_EVALUATION_PROVIDER must be "claude".'
    );
    expect(() => loadEnvConfig({ CAREER_OPS_EVALUATION_TIMEOUT_MS: "59999" })).toThrow();
    expect(() => loadEnvConfig({ CAREER_OPS_EVALUATION_TIMEOUT_MS: "3600001" })).toThrow();
    expect(() => loadEnvConfig({ CAREER_OPS_EVALUATION_CLI: "bin/claude" })).toThrow(
      "CAREER_OPS_EVALUATION_CLI must be an absolute path."
    );
  });

  it("loads local pairing token from env", () => {
    expect(
      loadEnvConfig({ CAREER_OPS_PAIRING_TOKEN: "local-secret" }).pairingToken
    ).toBe("local-secret");
  });

  it("resolves safe defaults and uses cwd as workspace candidate", () => {
    const config = loadRuntimeConfig({
      argv: [],
      env: {},
      cwd: "/tmp/career-ops"
    });

    expect(config).toMatchObject({
      host: "127.0.0.1",
      port: 3000,
      workspace: "/tmp/career-ops"
    });
  });

  it("lets env override defaults and CLI flags override env", () => {
    const config = loadRuntimeConfig({
      argv: ["--host", "0.0.0.0", "--port", "4000", "--workspace", "/cli/workspace"],
      env: {
        CAREER_OPS_HOST: "127.0.0.1",
        CAREER_OPS_PORT: "3001",
        CAREER_OPS_PAIRING_TOKEN: "local-secret"
      },
      cwd: "/cwd/workspace"
    });

    expect(config).toMatchObject({
      host: "0.0.0.0",
      port: 4000,
      workspace: "/cli/workspace",
      pairingToken: "local-secret"
    });
  });

  it("treats non-loopback hosts as LAN/private mode for token enforcement", () => {
    expect(isPairingTokenRequiredForHost("127.0.0.1")).toBe(false);
    expect(isPairingTokenRequiredForHost("localhost")).toBe(false);
    expect(isPairingTokenRequiredForHost("::1")).toBe(false);
    expect(isPairingTokenRequiredForHost("0.0.0.0")).toBe(true);
    expect(isPairingTokenRequiredForHost("192.168.1.20")).toBe(true);
  });
});
