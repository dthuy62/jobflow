import { chmod, copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = path.join(path.dirname(fileURLToPath(import.meta.url)), "fake-claude.mjs");

export interface FakeClaudeBehaviour {
  auth?: { loggedIn: boolean; raw?: string; delayMs?: number };
  run?: {
    stdout?: unknown;
    stderr?: string;
    exitCode?: number;
    delayMs?: number;
    hang?: boolean;
    stdoutRepeat?: { text: string; times: number };
  };
}

export interface FakeClaudeCall {
  argv: string[];
  cwd: string;
  envKeys: string[];
  env: Record<string, string>;
  stdin: string;
}

export interface FakeClaude {
  readonly cliPath: string;
  setBehaviour(behaviour: FakeClaudeBehaviour): Promise<void>;
  calls(): Promise<FakeClaudeCall[]>;
  authCalls(): Promise<number>;
  remove(): Promise<void>;
}

/** Copies the fake CLI into its own folder so parallel tests do not share state. */
export async function createFakeClaude(behaviour: FakeClaudeBehaviour = {}): Promise<FakeClaude> {
  const dir = await mkdtemp(path.join(tmpdir(), "fake-claude-"));
  const cliPath = path.join(dir, "claude.mjs");
  await copyFile(source, cliPath);
  await chmod(cliPath, 0o755);

  const fake: FakeClaude = {
    cliPath,
    async setBehaviour(next) {
      await writeFile(path.join(dir, "fake-claude.json"), JSON.stringify(next));
    },
    async calls() {
      const raw = await readFile(path.join(dir, "calls.jsonl"), "utf8").catch(() => "");
      return raw
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as FakeClaudeCall);
    },
    async authCalls() {
      const raw = await readFile(path.join(dir, "auth-calls.log"), "utf8").catch(() => "");
      return raw.split("\n").filter(Boolean).length;
    },
    async remove() {
      await rm(dir, { recursive: true, force: true });
    }
  };
  await fake.setBehaviour(behaviour);
  return fake;
}
