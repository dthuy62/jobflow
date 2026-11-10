// Run: node --test '.claude/skills/review-change/scripts/*.test.mjs'
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "tests-prove-change.mjs");

test("rejects a flag whose value is missing or another flag", () => {
  for (const argv of [
    ["--base", "--json"],
    ["--base"],
    ["--base", "HEAD", "--head"],
    ["--base", "HEAD", "--bogus"],
    ["--base", "HEAD", "--package"],
    ["--base", "HEAD", "--package", "../outside"],
    ["--base", "HEAD", "--package", "packages/x;touch PWNED"]
  ]) {
    const result = spawnSync("node", [script, ...argv], { encoding: "utf8" });
    assert.equal(result.status, 2, `${argv.join(" ")} should be a usage error`);
    assert.match(result.stderr, /usage:/);
  }
});

function write(root, file, content) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
}

function git(root, ...args) {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "core.hooksPath=/dev/null", ...args], {
    cwd: root,
    encoding: "utf8"
  });
}

/**
 * A workspace with no registry access: `vitest` is a local stand-in that reports one
 * test per file, which passes when `@jobflow/lib` holds the value on the test's first line.
 */
function createWorkspace() {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), "prove-change-")));
  write(root, ".gitignore", "node_modules/\ndist/\n");
  write(root, "package.json", JSON.stringify({ name: "root", private: true, workspaces: ["packages/*", "app"] }));
  write(root, "tools/fake-vitest/package.json", JSON.stringify({ name: "vitest", version: "1.0.0", type: "module", bin: { vitest: "bin.mjs" } }));
  write(
    root,
    "tools/fake-vitest/bin.mjs",
    `#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const argv = process.argv.slice(2);
const output = argv.find((arg) => arg.startsWith("--outputFile=")).split("=")[1];
const files = argv.filter((arg) => arg.endsWith(".test.ts"));
const entry = createRequire(path.join(process.cwd(), "x.js")).resolve("@jobflow/lib");
const { value } = await import(entry);
const testResults = files.map((file) => {
  const first = readFileSync(file, "utf8").split("\\n")[0];
  // "// imports <file>": the file fails to load, as vitest reports it, when <file> is missing.
  if (first.startsWith("// imports ") && !existsSync(first.replace("// imports ", ""))) {
    return { name: path.resolve(file), status: "failed", message: "Failed to load " + first.replace("// imports ", ""), assertionResults: [] };
  }
  const expected = first.replace("// expects ", "");
  const passed = value === expected;
  return { name: path.resolve(file), status: passed ? "passed" : "failed", assertionResults: [{ fullName: file, status: passed ? "passed" : "failed" }] };
});
writeFileSync(output, JSON.stringify({ testResults }));
`
  );
  write(
    root,
    "packages/lib/package.json",
    JSON.stringify({ name: "@jobflow/lib", version: "1.0.0", type: "module", exports: "./dist/index.js", scripts: { build: "node build.mjs" } })
  );
  write(
    root,
    "packages/lib/build.mjs",
    `import { copyFileSync, mkdirSync } from "node:fs";\nmkdirSync("dist", { recursive: true });\ncopyFileSync("src/index.js", "dist/index.js");\n`
  );
  write(root, "packages/lib/src/index.js", `export const value = "COMMITTED";\n`);
  write(
    root,
    "app/package.json",
    JSON.stringify({ name: "app", version: "1.0.0", type: "module", dependencies: { "@jobflow/lib": "*" }, devDependencies: { vitest: "file:../tools/fake-vitest" } })
  );
  write(root, "app/src/main.js", "export const a = 1;\n");
  execFileSync("npm", ["install", "--offline", "--no-audit", "--no-fund", "--silent"], { cwd: root });
  git(root, "init", "-q");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "base");
  // A build in the main checkout that differs from the commit, like a stale local dist.
  write(root, "packages/lib/dist/index.js", `export const value = "MAIN-CHECKOUT";\n`);
  return root;
}

function prove(root, ...argv) {
  const result = spawnSync("node", [script, "--base", "HEAD~1", "--json", ...argv], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("loads workspace packages from the worktree, not from the main checkout", () => {
  const root = createWorkspace();
  try {
    write(root, "app/src/main.js", "export const a = 2;\n");
    write(root, "app/test/main.test.ts", "// expects COMMITTED\n");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "head");

    const report = prove(root, "--package", "app");

    assert.equal(report.skipped, false);
    assert.deepEqual(report.revertedSource, ["M app/src/main.js"]);
    assert.equal(report.files[0].file, "app/test/main.test.ts");
    assert.deepEqual(report.counts, { failedWithoutChange: 0, inconclusive: 0, newStillPassing: 1, existingStillPassing: 0 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reverts only the named package's source", () => {
  const root = createWorkspace();
  try {
    write(root, "packages/lib/src/index.js", `export const value = "CHANGED";\n`);
    write(root, "app/src/main.js", "export const a = 2;\n");
    write(root, "app/test/main.test.ts", "// expects CHANGED\n");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "head");

    const report = prove(root, "--package", "app");

    assert.deepEqual(report.revertedSource, ["M app/src/main.js"]);
    assert.equal(report.counts.newStillPassing, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reports a test file that fails to load as inconclusive when reverted source was added", () => {
  const root = createWorkspace();
  try {
    // A moved source file: the base has no file at the new path, so the test cannot load.
    git(root, "mv", "app/src/main.js", "app/src/moved.js");
    write(root, "app/test/moved.test.ts", "// imports src/moved.js\n");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "head");

    const report = prove(root, "--package", "app");

    assert.deepEqual(report.revertedSource, ["D app/src/main.js", "A app/src/moved.js"]);
    assert.deepEqual(report.counts, { failedWithoutChange: 0, inconclusive: 1, newStillPassing: 0, existingStillPassing: 0 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("skips a package with no source change and names it", () => {
  const root = createWorkspace();
  try {
    write(root, "packages/lib/src/index.js", `export const value = "CHANGED";\n`);
    git(root, "add", "-A");
    git(root, "commit", "-qm", "head");

    const report = prove(root, "--package", "app");

    assert.equal(report.skipped, true);
    assert.match(report.reason, /no source changes in app/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
