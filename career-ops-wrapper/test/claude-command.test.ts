import { mkdtemp, rm, writeFile, chmod, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CHILD_ENV_ALLOWLIST,
  CLAUDE_EVALUATION_ARGV,
  EVALUATION_SYSTEM_PROMPT,
  buildChildEnv,
  resolveCliPath
} from "../src/evaluation/claude-command.js";
import { createCliAuthChecker } from "../src/evaluation/cli-auth.js";
import { EVALUATION_OUTPUT_JSON_SCHEMA } from "../src/contracts/index.js";
import { createFakeClaude, type FakeClaude } from "./support/fake-claude.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
});

async function fake(behaviour: Parameters<typeof createFakeClaude>[0] = {}): Promise<FakeClaude> {
  const created = await createFakeClaude(behaviour);
  cleanups.push(() => created.remove());
  return created;
}

describe("CLAUDE_EVALUATION_ARGV", () => {
  it("is the exact fixed command from the spec", () => {
    expect(CLAUDE_EVALUATION_ARGV).toEqual([
      "-p",
      "Evaluate the job offer provided on stdin. Reply with JSON only.",
      "--tools",
      "",
      "--strict-mcp-config",
      "--safe-mode",
      "--disable-slash-commands",
      "--permission-mode",
      "dontAsk",
      "--permission-prompts",
      "none",
      "--no-session-persistence",
      "--output-format",
      "json",
      "--json-schema",
      JSON.stringify(EVALUATION_OUTPUT_JSON_SCHEMA),
      "--system-prompt",
      EVALUATION_SYSTEM_PROMPT
    ]);
  });

  it("never allows tools, MCP or permission bypass", () => {
    const joined = CLAUDE_EVALUATION_ARGV.join(" ");
    expect(joined).not.toMatch(/dangerously|bypassPermissions|--mcp-config|--allowed-?tools|--add-dir|acceptEdits/i);
    expect(CLAUDE_EVALUATION_ARGV[CLAUDE_EVALUATION_ARGV.indexOf("--tools") + 1]).toBe("");
    expect(Object.isFrozen(CLAUDE_EVALUATION_ARGV)).toBe(true);
  });

  it("tells the model that the posting is untrusted and that it has no tools", () => {
    expect(EVALUATION_SYSTEM_PROMPT).toMatch(/untrusted/i);
    expect(EVALUATION_SYSTEM_PROMPT).toMatch(/no tools/i);
    expect(EVALUATION_SYSTEM_PROMPT).toContain("<job_posting");
  });
});

describe("buildChildEnv", () => {
  it("keeps only the allowlist and adds the fixed terminal settings", () => {
    const env = buildChildEnv({
      HOME: "/home/u",
      PATH: "/usr/bin",
      LANG: "en_US.UTF-8",
      CAREER_OPS_PAIRING_TOKEN: "secret-token",
      ANTHROPIC_API_KEY: "sk-ant-x",
      ANTHROPIC_AUTH_TOKEN: "t",
      CLAUDE_CODE_USE_BEDROCK: "1",
      CLAUDE_CODE_OAUTH_TOKEN: "o",
      HTTP_PROXY: "http://proxy",
      NODE_OPTIONS: "--require /tmp/x.js"
    });

    expect(env).toEqual({ HOME: "/home/u", PATH: "/usr/bin", LANG: "en_US.UTF-8", TERM: "dumb", NO_COLOR: "1" });
  });

  it("adds explicit extras", () => {
    expect(buildChildEnv({ HOME: "/h" }, { CAREER_OPS_ADDITIONS: "/tmp/a" })).toMatchObject({
      HOME: "/h",
      CAREER_OPS_ADDITIONS: "/tmp/a"
    });
    expect(CHILD_ENV_ALLOWLIST).toEqual(["HOME", "USER", "LOGNAME", "PATH", "SHELL", "TMPDIR", "LANG", "LC_ALL", "LC_CTYPE"]);
  });
});

describe("resolveCliPath", () => {
  it("uses a configured absolute path only when it is executable", async () => {
    const created = await fake();

    expect(await resolveCliPath({ cliPath: created.cliPath }, {})).toBe(created.cliPath);
    expect(await resolveCliPath({ cliPath: "/nonexistent/claude" }, {})).toBeUndefined();
  });

  it("finds claude on PATH", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "path-claude-"));
    cleanups.push(() => rm(dir, { recursive: true, force: true }));
    const bin = path.join(dir, "bin");
    await mkdir(bin);
    await writeFile(path.join(bin, "claude"), "#!/bin/sh\n");
    await chmod(path.join(bin, "claude"), 0o755);

    expect(await resolveCliPath({}, { PATH: `/nonexistent:${bin}` })).toBe(path.join(bin, "claude"));
    expect(await resolveCliPath({}, { PATH: "/nonexistent" })).toBeUndefined();
  });
});

describe("createCliAuthChecker", () => {
  it("reads loggedIn from auth status", async () => {
    const created = await fake({ auth: { loggedIn: true } });
    expect(await createCliAuthChecker(created.cliPath).check()).toBe("logged-in");

    await created.setBehaviour({ auth: { loggedIn: false } });
    expect(await createCliAuthChecker(created.cliPath).check()).toBe("logged-out");

    await created.setBehaviour({ auth: { loggedIn: true, raw: "not json" } });
    expect(await createCliAuthChecker(created.cliPath).check()).toBe("check-failed");
  });

  it("shares one check between concurrent callers and caches it", async () => {
    const created = await fake({ auth: { loggedIn: true, delayMs: 100 } });
    let now = 0;
    const checker = createCliAuthChecker(created.cliPath, { now: () => now });

    const results = await Promise.all(Array.from({ length: 20 }, () => checker.check()));
    expect(new Set(results)).toEqual(new Set(["logged-in"]));
    expect(await created.authCalls()).toBe(1);

    now = 59_000;
    await checker.check();
    expect(await created.authCalls()).toBe(1);

    await checker.check(true);
    expect(await created.authCalls()).toBe(2);

    now = 200_000;
    await checker.check();
    expect(await created.authCalls()).toBe(3);
  });
});
