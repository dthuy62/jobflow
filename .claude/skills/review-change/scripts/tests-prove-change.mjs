#!/usr/bin/env node
// Layer 0 "tests prove the change" check for career-ops-wrapper.
// Checks out <head> in a throwaway git worktree, reverts only the non-test
// source files (career-ops-wrapper/src/**) to <base>, and runs the added and
// changed test files there. A new test that still passes proves nothing.
// The caller's working tree is never modified.
// Usage: node tests-prove-change.mjs --base <rev> [--head <rev>] [--json]

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const WRAPPER = "career-ops-wrapper";
const args = parseArgs(process.argv.slice(2));
if (!args.base) {
  console.error("usage: node tests-prove-change.mjs --base <rev> [--head <rev>] [--json]");
  process.exit(2);
}
const head = args.head ?? "HEAD";
const repoRoot = git(["rev-parse", "--show-toplevel"], process.cwd()).trim();
const nodeModules = path.join(repoRoot, WRAPPER, "node_modules");

const changed = git(["diff", "--name-status", "--no-renames", `${args.base}..${head}`, "--", `${WRAPPER}/`], repoRoot)
  .split("\n").filter(Boolean).map((line) => {
    const [status, file] = line.split("\t");
    return { status, file };
  });
const sourceFiles = changed.filter(({ file }) => file.startsWith(`${WRAPPER}/src/`));
const testFiles = changed.filter(({ file, status }) => status !== "D" && /^career-ops-wrapper\/test\/.*\.test\.ts$/.test(file));

if (sourceFiles.length === 0 || testFiles.length === 0) {
  emit({ skipped: true, reason: sourceFiles.length === 0 ? "no wrapper source changes" : "no added or changed wrapper tests", sourceFiles, testFiles });
  process.exit(0);
}
if (!existsSync(nodeModules)) {
  console.error(`missing ${nodeModules}; run npm ci in ${WRAPPER} first`);
  process.exit(2);
}

const scratch = mkdtempSync(path.join(process.env.TMPDIR ?? tmpdir(), "tests-prove-change-"));
const tree = path.join(scratch, "tree");
try {
  git(["worktree", "add", "--detach", tree, head], repoRoot);
  symlinkSync(nodeModules, path.join(tree, WRAPPER, "node_modules"), "dir");
  for (const { file, status } of sourceFiles) {
    if (status === "A") rmSync(path.join(tree, file), { force: true });
    else git(["checkout", args.base, "--", file], tree);
  }

  const vitest = runVitest(testFiles.map(({ file }) => file), "head-tests");
  if (!vitest) throw new Error("vitest produced no JSON report");

  // Names of tests that already existed: run the base versions of the same
  // test files. Parameterized titles (it.each) only match this way.
  const existingAtBase = testFiles.filter(({ status }) => status === "M").map(({ file }) => file);
  for (const file of existingAtBase) git(["checkout", args.base, "--", file], tree);
  const baseRun = existingAtBase.length ? runVitest(existingAtBase, "base-tests") : null;
  const baseNames = new Set((baseRun?.testResults ?? []).flatMap((result) => (result.assertionResults ?? []).map((test) => test.fullName)));
  emit(summarize(vitest, baseNames));
} finally {
  try {
    git(["worktree", "remove", "--force", tree], repoRoot);
  } catch {
    // The worktree may not exist if `worktree add` failed.
  }
  rmSync(scratch, { recursive: true, force: true });
}

function runVitest(files, label) {
  const reportPath = path.join(scratch, `${label}.json`);
  spawnSync("npx", ["vitest", "run", ...files.map((file) => path.relative(WRAPPER, file)), "--reporter=json", `--outputFile=${reportPath}`], {
    cwd: path.join(tree, WRAPPER),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 300_000
  });
  return existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : null;
}

function summarize(vitest, baseNames) {
  const files = [];
  for (const result of vitest.testResults ?? []) {
    // Vitest reports real paths (/private/var/… on macOS), so match on the suffix.
    const repoFile = result.name.slice(result.name.lastIndexOf(`/${WRAPPER}/`) + 1);
    const tests = (result.assertionResults ?? []).map((assertion) => ({
      name: assertion.fullName,
      status: assertion.status,
      isNew: !baseNames.has(assertion.fullName)
    }));
    files.push({
      file: repoFile,
      loadFailed: tests.length === 0 && result.status === "failed",
      message: tests.length === 0 ? String(result.message ?? "").split("\n")[0].slice(0, 200) : undefined,
      tests
    });
  }
  const all = files.flatMap((entry) => entry.tests);
  return {
    skipped: false,
    revertedSource: sourceFiles.map(({ status, file }) => `${status} ${file}`),
    testFiles: testFiles.map(({ file }) => file),
    counts: {
      failedWithoutChange: all.filter((test) => test.status === "failed").length + files.filter((entry) => entry.loadFailed).length,
      newStillPassing: all.filter((test) => test.isNew && test.status === "passed").length,
      existingStillPassing: all.filter((test) => !test.isNew && test.status === "passed").length
    },
    files
  };
}

function emit(result) {
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  const out = ["# Tests prove the change"];
  if (result.skipped) {
    out.push("", `Skipped: ${result.reason}.`);
    console.log(out.join("\n"));
    return;
  }
  out.push("", `Reverted ${result.revertedSource.length} source file(s) to ${args.base}; ran ${result.testFiles.length} added/changed test file(s).`);
  out.push(`- failed without the change (good): ${result.counts.failedWithoutChange}`);
  out.push(`- NEW tests still passing without the change (prove nothing): ${result.counts.newStillPassing}`);
  out.push(`- existing tests still passing (expected for untouched behavior): ${result.counts.existingStillPassing}`);
  for (const entry of result.files) {
    if (entry.loadFailed) {
      out.push("", `## ${entry.file}: whole file failed to load (good): ${entry.message}`);
      continue;
    }
    const suspicious = entry.tests.filter((test) => test.isNew && test.status === "passed");
    if (suspicious.length === 0) continue;
    out.push("", `## ${entry.file}`);
    for (const test of suspicious) out.push(`- PASSES WITHOUT CHANGE: ${test.name}`);
  }
  console.log(out.join("\n"));
}

function git(gitArgs, cwd) {
  return execFileSync("git", gitArgs, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") parsed.json = true;
    else if (arg === "--base") parsed.base = argv[++index];
    else if (arg === "--head") parsed.head = argv[++index];
  }
  return parsed;
}
