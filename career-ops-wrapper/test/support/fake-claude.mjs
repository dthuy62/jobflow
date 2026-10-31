#!/usr/bin/env node
// Test stand-in for the `claude` CLI. Its behaviour comes from
// `fake-claude.json` next to this file (the wrapper passes no custom env), and
// every evaluation call is recorded to `calls.jsonl` in the same folder.
import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const behaviour = JSON.parse(readFileSync(join(here, "fake-claude.json"), "utf8"));
const args = process.argv.slice(2);

if (args[0] === "auth") {
  appendFileSync(join(here, "auth-calls.log"), "x\n");
  const auth = behaviour.auth ?? { loggedIn: true };
  setTimeout(() => {
    process.stdout.write(auth.raw ?? JSON.stringify({ loggedIn: auth.loggedIn, authMethod: "claude.ai" }));
    process.exit(auth.loggedIn ? 0 : 1);
  }, auth.delayMs ?? 0);
} else {
  let stdin = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => (stdin += chunk));
  process.stdin.on("end", () => {
    appendFileSync(
      join(here, "calls.jsonl"),
      JSON.stringify({ argv: args, cwd: process.cwd(), envKeys: Object.keys(process.env).sort(), env: process.env, stdin }) + "\n"
    );
    const run = behaviour.run ?? {};
    if (run.hang) {
      setInterval(() => {}, 1000);
      return;
    }
    setTimeout(() => {
      if (run.stderr) process.stderr.write(run.stderr);
      if (run.stdoutRepeat) process.stdout.write(run.stdoutRepeat.text.repeat(run.stdoutRepeat.times));
      if (run.stdout !== undefined) process.stdout.write(typeof run.stdout === "string" ? run.stdout : JSON.stringify(run.stdout));
      process.exitCode = run.exitCode ?? 0;
    }, run.delayMs ?? 0);
  });
}
