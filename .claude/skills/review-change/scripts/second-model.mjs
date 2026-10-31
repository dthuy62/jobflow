#!/usr/bin/env node
// Optional second-model reviewer: runs one role prompt through the Gemini CLI
// in read-only plan mode. Exit 3 means "not available"; the caller continues
// without it. Never passes --yolo or an edit approval mode.
// Usage: node second-model.mjs --role <prompt.md> --input <file> [--input <file>…]
//          [--set KEY=VALUE…] [--timeout-ms 600000]

import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = parseArgs(process.argv.slice(2));
if (!args.role || args.inputs.length === 0 || !Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
  console.error("usage: node second-model.mjs --role <prompt.md> --input <file> [--input <file>…] [--set KEY=VALUE…] [--timeout-ms N]");
  process.exit(2);
}

const probe = spawnSync("gemini", ["--version"], { encoding: "utf8", timeout: 15_000 });
if (probe.error || probe.status !== 0) {
  console.error("second-model: gemini CLI not available; skipping");
  process.exit(3);
}

// Fill the role file's {{KEY}} placeholders, as the Agent-tool reviewers get them.
const role = readFileSync(args.role, "utf8").replace(/\{\{(\w+)\}\}/g, (match, key) => args.values[key] ?? match);
const context = args.inputs.map((file) => `===== ${file} =====\n${readFileSync(file, "utf8")}`).join("\n\n");
const prompt = `${role}\n\nYou are in read-only plan mode. Do not propose to edit files. The review inputs follow on stdin.`;

const child = spawn("gemini", ["-p", prompt, "--approval-mode", "plan", "--output-format", "text"], {
  stdio: ["pipe", "pipe", "pipe"]
});
let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => (stdout += chunk));
child.stderr.on("data", (chunk) => (stderr += chunk));
const timer = setTimeout(() => child.kill("SIGTERM"), args.timeoutMs);
child.stdin.end(context);
child.on("close", (code, signal) => {
  clearTimeout(timer);
  if (code !== 0 || stdout.trim() === "") {
    console.error(`second-model: gemini failed (code ${code}, signal ${signal}); skipping\n${stderr.slice(-2000)}`);
    process.exit(3);
  }
  process.stdout.write(stdout);
});

function parseArgs(argv) {
  const parsed = { inputs: [], values: {}, timeoutMs: 600_000 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--role") parsed.role = argv[++index];
    else if (arg === "--input") parsed.inputs.push(argv[++index]);
    else if (arg === "--timeout-ms") parsed.timeoutMs = Number(argv[++index]);
    else if (arg === "--set") {
      const pair = argv[++index] ?? "";
      const separator = pair.indexOf("=");
      // A malformed pair makes the usage check fail (exit 2).
      if (separator <= 0) parsed.timeoutMs = Number.NaN;
      else parsed.values[pair.slice(0, separator)] = pair.slice(separator + 1);
    }
  }
  return parsed;
}
