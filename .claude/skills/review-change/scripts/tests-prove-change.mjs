#!/usr/bin/env node
// Layer 0 "tests prove the change" check for one workspace package.
// Checks out <head> in a throwaway git worktree, installs and builds there,
// reverts only the package's non-test source files (<package>/src/**) to <base>,
// and runs the added and changed test files. A new test that still passes proves
// nothing. The caller's working tree is never modified.
// Usage: node tests-prove-change.mjs --base <rev> [--head <rev>] [--package <dir>] [--json]

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const PACKAGE = args?.package ?? "career-ops-wrapper";
if (!args?.base || !/^(?:packages\/)?[a-z0-9][a-z0-9._-]*$/.test(PACKAGE)) {
  console.error("usage: node tests-prove-change.mjs --base <rev> [--head <rev>] [--package <dir>] [--json]");
  process.exit(2);
}
const head = args.head ?? "HEAD";
const repoRoot = git(["rev-parse", "--show-toplevel"], process.cwd()).trim();

const changed = git(["diff", "--name-status", "--no-renames", `${args.base}..${head}`, "--", `${PACKAGE}/`], repoRoot)
  .split("\n").filter(Boolean).map((line) => {
    const [status, file] = line.split("\t");
    return { status, file };
  });
const sourceFiles = changed.filter(({ file }) => file.startsWith(`${PACKAGE}/src/`));
const testFiles = changed.filter(({ file, status }) => status !== "D" && file.startsWith(`${PACKAGE}/test/`) && file.endsWith(".test.ts"));

if (sourceFiles.length === 0 || testFiles.length === 0) {
  emit({ skipped: true, reason: sourceFiles.length === 0 ? `no source changes in ${PACKAGE}` : `no added or changed tests in ${PACKAGE}`, sourceFiles, testFiles });
  process.exit(0);
}

const scratch = mkdtempSync(path.join(process.env.TMPDIR ?? tmpdir(), "tests-prove-change-"));
const tree = path.join(scratch, "tree");
try {
  git(["worktree", "add", "--detach", tree, head], repoRoot);
  installAndBuild();
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

/**
 * A real install, not a symlink to the main checkout's node_modules: npm's workspace
 * links would then load `@jobflow/*` from the main checkout. Packages are built here
 * because dependents import their `dist`.
 */
function installAndBuild() {
  run("npm", ["ci", "--prefer-offline", "--ignore-scripts", "--no-audit", "--no-fund"]);
  const packagesDir = path.join(tree, "packages");
  if (!existsSync(packagesDir)) return;
  for (const name of readdirSync(packagesDir)) {
    if (existsSync(path.join(packagesDir, name, "package.json"))) run("npm", ["run", "build", "--if-present", "-w", `packages/${name}`]);
  }
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: tree, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 300_000 });
  if (result.status !== 0) throw new Error(`${command} ${commandArgs.join(" ")} failed: ${String(result.stderr).slice(0, 500)}`);
}

function runVitest(files, label) {
  const reportPath = path.join(scratch, `${label}.json`);
  spawnSync("npx", ["vitest", "run", ...files.map((file) => path.relative(PACKAGE, file)), "--reporter=json", `--outputFile=${reportPath}`], {
    cwd: path.join(tree, PACKAGE),
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
    const repoFile = result.name.slice(result.name.lastIndexOf(`/${PACKAGE}/`) + 1);
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
  // Reverting an added (or moved) source file deletes it, so a test that imports it fails
  // to load whatever it asserts: that proves nothing about the change.
  const addedSource = sourceFiles.some(({ status }) => status === "A");
  for (const entry of files) entry.inconclusive = entry.loadFailed && addedSource;
  return {
    skipped: false,
    revertedSource: sourceFiles.map(({ status, file }) => `${status} ${file}`),
    testFiles: testFiles.map(({ file }) => file),
    counts: {
      failedWithoutChange: all.filter((test) => test.status === "failed").length + files.filter((entry) => entry.loadFailed && !entry.inconclusive).length,
      inconclusive: files.filter((entry) => entry.inconclusive).length,
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
  out.push(`- failed to load because an added source file was removed (inconclusive, read the test): ${result.counts.inconclusive}`);
  out.push(`- NEW tests still passing without the change (prove nothing): ${result.counts.newStillPassing}`);
  out.push(`- existing tests still passing (expected for untouched behavior): ${result.counts.existingStillPassing}`);
  for (const entry of result.files) {
    if (entry.loadFailed) {
      out.push("", `## ${entry.file}: whole file failed to load (${entry.inconclusive ? "INCONCLUSIVE, an added source file was removed" : "good"}): ${entry.message}`);
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

/** Returns null on an unknown flag or a flag whose value is missing or another flag. */
function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") parsed.json = true;
    else if (arg === "--base" || arg === "--head" || arg === "--package") {
      const value = argv[++index];
      if (value === undefined || value.startsWith("-")) return null;
      parsed[arg.slice(2)] = value;
    } else return null;
  }
  return parsed;
}
