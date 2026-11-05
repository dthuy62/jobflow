#!/usr/bin/env node
// Keeps vendor/career-ops in step with upstream, deliberately. Upstream is untrusted input: this
// reads its git objects as data, and installs nothing and runs nothing from it.
// Usage: node scripts/sync-career-ops.mjs [--commit <sha>] [--write | --check] [--vendor-dir <dir>]
//   no mode  print the differences from upstream, and change nothing
//   --write  copy the allowlisted entries and what they import, and record the commit
//   --check  compare the vendored files with the recorded hashes, with no network
// A new provider needs a terms check before it ships: see vendor/career-ops/README.md.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_VENDOR_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "vendor", "career-ops");
const MANIFEST = "UPSTREAM.json";
/** Files of ours in the vendor directory, not copied from upstream. Lower case, for case-insensitive disks. */
const OWN_FILES = new Set([MANIFEST.toLowerCase(), "readme.md"]);
/** A conservative path, so a hostile name cannot reach a shell, a flag or a parent directory. */
const SAFE_PATH = /^[A-Za-z0-9_][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_][A-Za-z0-9._-]*)*$/;
/** Instruction files that coding agents load by name, which would turn upstream's text into project rules. */
const AGENT_FILE = /^(?:agents|claude|gemini|codex)(?:\.[a-z]+)?\.md$/i;
// A full hash, because upstream can name a branch after a short one and git would prefer the branch.
const SAFE_COMMIT = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const CODE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const COMPUTED_IMPORT = /\b(?:import|require)\s*\(\s*(?!["'][^"'\n]*["']\s*[,)])(?!`[^`$\n]*`\s*[,)])|\bcreateRequire\b|\brequire\.resolve\b/;

/** Thrown rather than exiting, so the temporary clone is still removed on the way out. */
class SyncError extends Error {}

const args = parseArgs(process.argv.slice(2));
if (args === null) {
  console.error("usage: sync-career-ops.mjs [--commit <sha>] [--write | --check] [--vendor-dir <dir>]");
  process.exit(2);
}

const vendorDir = path.resolve(args.vendorDir ?? DEFAULT_VENDOR_DIR);
const manifestPath = path.join(vendorDir, MANIFEST);

let manifest;
try {
  manifest = readManifest();
  if (args.check) check();
  else sync();
} catch (error) {
  if (!(error instanceof SyncError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}

function sync() {
  const clone = mkdtempSync(path.join(tmpdir(), "sync-career-ops-clone-"));
  const scratch = mkdtempSync(path.join(tmpdir(), "sync-career-ops-tree-"));
  try {
    // Bare: no checkout, so nothing is written from the tree and no hook of ours or theirs runs.
    git(["clone", "--quiet", "--bare", "--filter=blob:none", "--", manifest.repository, clone]);
    const commit = git(["-C", clone, "rev-parse", "--verify", `${args.commit ?? "HEAD"}^{commit}`]).trim();
    const collected = collect(clone, commit);

    if (args.write) {
      writeVendored(collected, commit);
      report(collected);
    } else {
      printDifferences(collected, commit, scratch);
    }
  } finally {
    rmSync(clone, { recursive: true, force: true });
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** Reads each allowlisted entry and, statically, what it imports. Nothing is written until all of it is read. */
function collect(clone, commit) {
  const tree = new Map();
  for (const line of git(["-C", clone, "ls-tree", "-r", "-z", commit]).split("\0").filter(Boolean)) {
    const [info, name] = line.split("\t");
    tree.set(name, info.split(" ")[0]);
  }

  const files = new Map();
  const packages = new Set();
  const computed = new Set();
  const pending = manifest.entries.flatMap((entry) => expandEntry(entry, tree));

  while (pending.length > 0) {
    const file = pending.pop();
    if (files.has(file)) continue;
    assertSafePath(file, "path");
    if (isOwnFile(file)) fail(`Refusing ${file}: it would overwrite our own file.`);
    const mode = tree.get(file);
    if (mode === undefined) fail(`${file} is not in upstream at ${commit}.`);
    // Any other mode is a symlink or a submodule, which could point anywhere.
    if (mode !== "100644" && mode !== "100755") fail(`${file} is not a regular file (mode ${mode}), such as a symlink.`);
    // cat-file, for the stored bytes: no filter or textconv that upstream's attributes might ask for.
    const content = execFileSync("git", ["-C", clone, "cat-file", "blob", `${commit}:${file}`], { maxBuffer: 64 * 1024 * 1024 });
    files.set(file, content);
    if (!CODE_FILE.test(file)) continue;

    const text = content.toString("utf8");
    if (COMPUTED_IMPORT.test(text)) computed.add(file);
    for (const specifier of importsOf(text)) {
      if (specifier.startsWith(".")) {
        const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
        if (resolved.startsWith("..")) fail(`${file} imports ${JSON.stringify(specifier)}, which leaves the repository.`);
        pending.push(resolved);
      } else if (!isBuiltin(specifier)) {
        packages.add(specifier);
      }
    }
  }
  return { files, packages, computed };
}

/** TypeScript's scanner: it runs nothing, and tells a comment or a string from an import. */
function importsOf(text) {
  const ts = createRequire(import.meta.url)("typescript");
  return ts.preProcessFile(text, true, true).importedFiles.map((entry) => entry.fileName);
}

function expandEntry(entry, tree) {
  if (entry.endsWith("/*")) {
    const dir = entry.slice(0, -2);
    assertSafePath(dir, "entry");
    const found = [...tree.keys()].filter((name) => name.startsWith(`${dir}/`) && !name.slice(dir.length + 1).includes("/"));
    if (found.length === 0) fail(`The entry ${entry} matches nothing in upstream.`);
    return found;
  }
  assertSafePath(entry, "entry");
  if (!tree.has(entry)) fail(`The entry ${entry} is not in upstream.`);
  return [entry];
}

function assertSafePath(value, kind) {
  if (!SAFE_PATH.test(value) || value.split("/").includes("..")) fail(`Refusing the ${kind} ${JSON.stringify(value)}: it is not a plain relative path.`);
  if (AGENT_FILE.test(path.posix.basename(value))) fail(`Refusing the ${kind} ${value}: coding agents would load it as instructions.`);
}

function writeVendored({ files }, commit) {
  const current = new Set(vendoredFiles());
  for (const file of [...current].sort(compare)) {
    if (files.has(file)) continue;
    rmSync(safeTarget(file));
    console.log(`removed  ${file}`);
  }
  const recorded = [];
  for (const [file, content] of [...files].sort(([left], [right]) => compare(left, right))) {
    const target = safeTarget(file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
    recorded.push({ path: file, sha256: hash(content) });
    if (!current.has(file)) console.log(`added    ${file}`);
  }
  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, commit, files: recorded }, null, 2)}\n`);
  console.log(`Vendored ${files.size} files at ${commit}.`);
}

function safeTarget(file) {
  const target = path.resolve(vendorDir, file);
  if (!target.startsWith(vendorDir + path.sep)) fail(`Refusing ${file}: it leaves the vendor directory.`);
  return target;
}

function printDifferences(collected, commit, scratch) {
  const { files } = collected;
  const current = new Set(vendoredFiles());
  const lines = [];
  for (const file of [...new Set([...current, ...files.keys()])].sort(compare)) {
    if (!files.has(file)) lines.push(`removed  ${file}`);
    else if (!current.has(file)) lines.push(`added    ${file}`);
    else if (hash(readFileSync(safeTarget(file))) !== hash(files.get(file))) lines.push(`changed  ${file}`);
  }
  console.log(`Upstream ${commit}, pinned ${manifest.commit || "(none)"}.`);
  report(collected);
  if (lines.length === 0) {
    console.log("No differences.");
    return;
  }
  console.log(lines.join("\n"));

  // Only the files under review, so the diff leaves out our own files in the vendor directory.
  const before = path.join(scratch, "before");
  const after = path.join(scratch, "after");
  mkdirSync(before);
  mkdirSync(after);
  for (const file of current) {
    mkdirSync(path.dirname(path.join(before, file)), { recursive: true });
    writeFileSync(path.join(before, file), readFileSync(safeTarget(file)));
  }
  for (const [file, content] of files) {
    mkdirSync(path.dirname(path.join(after, file)), { recursive: true });
    writeFileSync(path.join(after, file), content);
  }
  const diff = spawnSync("git", ["diff", "--no-index", "--text", "--no-color", "--no-ext-diff", "--no-textconv", "before", "after"], { cwd: scratch, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  // A cut-off diff could leave out the change a reader most needs to see. Status 1 only means "differs".
  if (diff.error || diff.status !== 1) fail(`Could not print the diff: ${diff.error?.message ?? diff.stderr}`);
  process.stdout.write(`\n${printable(diff.stdout)}`);
}

function report({ packages, computed }) {
  if (packages.size > 0) console.log(`Package imports, not vendored: ${printable([...packages].sort(compare).join(", "))}`);
  for (const file of [...computed].sort(compare)) console.log(`${file}: a dynamic import with a computed path was not followed.`);
}

/** Offline, so a check never depends on upstream still existing. The pinned hashes came from upstream at --write. */
function check() {
  const problems = [];
  if (!SAFE_COMMIT.test(manifest.commit ?? "")) problems.push(`${MANIFEST} records no full commit hash.`);
  const recorded = new Map(manifest.files.map((entry) => [entry.path, entry.sha256]));
  if (recorded.size === 0) problems.push(`${MANIFEST} records no files.`);
  for (const [file, expected] of recorded) {
    assertSafePath(file, "path");
    const target = safeTarget(file);
    if (!existsSync(target)) problems.push(`${file} is missing.`);
    else if (hash(readFileSync(target)) !== expected) problems.push(`${file} differs from upstream at ${manifest.commit}.`);
  }
  for (const file of vendoredFiles()) {
    if (!recorded.has(file)) problems.push(`${file} is not in ${MANIFEST}.`);
  }
  if (problems.length > 0) fail(`${problems.join("\n")}\nVendored files change only through this script.`);
  console.log(`${recorded.size} vendored files match ${manifest.commit}.`);
}

function vendoredFiles() {
  if (!existsSync(vendorDir)) return [];
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".DS_Store") continue; // Finder writes these, and git ignores them.
      const full = path.join(dir, entry.name);
      const file = path.relative(vendorDir, full).split(path.sep).join("/");
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) found.push(file);
      else fail(`${file} is not a regular file, such as a symlink.`);
    }
  };
  walk(vendorDir);
  return found.filter((file) => !isOwnFile(file));
}

function readManifest() {
  if (!existsSync(manifestPath)) fail(`${manifestPath} does not exist.`);
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

/** Upstream's text reaches the terminal here, where an escape sequence could hide a line of the diff. */
function printable(text) {
  return text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "?");
}

function isOwnFile(file) {
  return OWN_FILES.has(file.toLowerCase());
}

function hash(content) {
  return createHash("sha256").update(content).digest("hex");
}

function compare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function git(gitArgs) {
  return execFileSync("git", gitArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

function fail(message) {
  throw new SyncError(message);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") parsed.write = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--commit") {
      const value = argv[++index];
      if (value === undefined || !SAFE_COMMIT.test(value)) return null;
      parsed.commit = value;
    } else if (arg === "--vendor-dir") {
      const value = argv[++index];
      if (value === undefined || value.startsWith("-")) return null;
      parsed.vendorDir = value;
    } else return null;
  }
  return parsed.write && parsed.check ? null : parsed;
}
