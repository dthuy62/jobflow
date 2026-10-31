// Run: node --test '.claude/skills/review-change/scripts/*.test.mjs'
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "impact-map.mjs");

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

test("maps changed symbols, routes, schemas, Android DTOs and risk reviewers", () => {
  const root = mkdtempSync(path.join(tmpdir(), "impact-map-"));
  try {
    git(root, "init", "-q");
    write(root, "career-ops-wrapper/src/contracts/offer-contract.ts", "export const OfferDtoSchema = z.object({ id: z.string() });\n");
    write(root, "career-ops-wrapper/src/services/offer-service.ts", "export function listOffers() {\n  return [];\n}\n");
    write(root, "career-ops-wrapper/src/api/offer-routes.ts", "import { listOffers } from '../services/offer-service.js';\n");
    write(root, "android/app/src/main/kotlin/me/x/data/remote/dto/Dtos.kt", "data class OfferDto(val id: String)\n");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "base");

    write(root, "career-ops-wrapper/src/contracts/offer-contract.ts", "export const OfferDtoSchema = z.object({ id: z.string(), score: z.number() });\n");
    write(root, "career-ops-wrapper/src/services/offer-service.ts", "export function listOffers() {\n  return readFile('data/pipeline.md');\n}\n");
    write(
      root,
      "career-ops-wrapper/src/api/offer-routes.ts",
      "import { listOffers } from '../services/offer-service.js';\nserver.get(\"/offers\", async () => listOffers());\n"
    );
    git(root, "commit", "-qam", "head");

    const report = JSON.parse(execFileSync("node", [script, "--base", "HEAD~1", "--json"], { cwd: root, encoding: "utf8" }));

    assert.deepEqual(report.components, ["wrapper"]);
    assert.deepEqual(report.gates, ["cd career-ops-wrapper && npm test && npm run build"]);
    assert.ok(report.reviewers.includes("security"), "new route requires the security reviewer");
    assert.equal(report.tier, "L");
    assert.deepEqual(report.routes.map(({ method, path: route, side }) => `${side}${method} ${route}`), ["+GET /offers"]);

    const listOffers = report.symbols.find((symbol) => symbol.name === "listOffers");
    assert.ok(listOffers.references.some((ref) => ref.startsWith("career-ops-wrapper/src/api/offer-routes.ts:")));

    const schema = report.schemas.find((entry) => entry.name === "OfferDtoSchema");
    assert.equal(schema.androidDto, "OfferDto");
    assert.equal(schema.androidRefs.length, 1);

    assert.deepEqual(report.workspacePaths.map((entry) => entry.literal), ["data/pipeline.md"]);
    assert.ok(report.risks.contracts && report.risks.routes && report.risks["untrusted-input"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("adds the Android gate when shared contract examples change", () => {
  const root = mkdtempSync(path.join(tmpdir(), "impact-map-"));
  try {
    git(root, "init", "-q");
    write(root, "career-ops-wrapper/contracts/examples/offer.valid.json", "{}\n");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "base");
    write(root, "career-ops-wrapper/contracts/examples/offer.valid.json", "{\"id\":\"offer_1\"}\n");
    git(root, "commit", "-qam", "head");

    const report = JSON.parse(execFileSync("node", [script, "--base", "HEAD~1", "--json"], { cwd: root, encoding: "utf8" }));

    assert.ok(report.gates.some((gate) => gate.includes("./gradlew")));
    assert.ok(report.gates.some((gate) => gate.includes("npm test")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function mapAfterEdit(before, after) {
  const root = mkdtempSync(path.join(tmpdir(), "impact-map-"));
  try {
    git(root, "init", "-q");
    write(root, "career-ops-wrapper/src/a.ts", before);
    write(root, "career-ops-wrapper/src/b.ts", "import { alphaFirst, betaSecond } from './a.js';\nbetaSecond(alphaFirst(1));\n");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "base");
    write(root, "career-ops-wrapper/src/a.ts", after);
    git(root, "commit", "-qam", "head");
    return JSON.parse(execFileSync("node", [script, "--base", "HEAD~1", "--json"], { cwd: root, encoding: "utf8" }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const A_TS = [
  "export function alphaFirst(x: number) {",
  "  return x;",
  "}",
  "/**",
  " * Doubles x.",
  " */",
  "export function betaSecond(x: number) {",
  "  const y = x * 2;",
  "  return y;",
  "}",
  ""
];

test("attributes a pure deletion to the declaration that contained it", () => {
  const after = A_TS.filter((line) => line !== "  const y = x * 2;");
  const names = mapAfterEdit(A_TS.join("\n"), after.join("\n")).symbols.map((symbol) => symbol.name);
  assert.deepEqual(names, ["betaSecond"]);
});

test("attributes a JSDoc edit to the declaration it documents", () => {
  const after = A_TS.map((line) => (line === " * Doubles x." ? " * Doubles x; throws on NaN." : line));
  const names = mapAfterEdit(A_TS.join("\n"), after.join("\n")).symbols.map((symbol) => symbol.name);
  assert.deepEqual(names, ["betaSecond"]);
});

test("does not grep the repository for file-local TypeScript symbols", () => {
  // b.ts mentions the same name, but a file-local symbol cannot be imported from there.
  const before = "const betaSecond = 1;\nexport const kept = betaSecond;\n";
  const after = "const betaSecond = 2;\nexport const kept = betaSecond;\n";
  const report = mapAfterEdit(before, after);
  const local = report.symbols.find((symbol) => symbol.name === "betaSecond");
  assert.deepEqual(local.references, []);
});

function mapAfterCommit(files) {
  const root = mkdtempSync(path.join(tmpdir(), "impact-map-"));
  try {
    git(root, "init", "-q");
    for (const [file, content] of Object.entries(files)) write(root, file, content.before);
    git(root, "add", "-A");
    git(root, "commit", "-qm", "base");
    for (const [file, content] of Object.entries(files)) write(root, file, content.after);
    git(root, "commit", "-qam", "head");
    return JSON.parse(execFileSync("node", [script, "--base", "HEAD~1", "--json"], { cwd: root, encoding: "utf8" }));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("classifies non-ASCII paths instead of git's quoted form", () => {
  const report = mapAfterCommit({
    "career-ops-wrapper/src/security/pairing-tokén.ts": {
      before: "export function checkToken() {\n  return false;\n}\n",
      after: "export function checkToken() {\n  return true;\n}\n"
    }
  });
  assert.ok(report.reviewers.includes("security"));
  assert.deepEqual(report.symbols.map((symbol) => symbol.name), ["checkToken"]);
});

test("keeps changed lines that start with ++ or --", () => {
  const report = mapAfterCommit({
    "career-ops-wrapper/src/services/x.ts": {
      // Unindented, so the diff line reads `---i; …` like a file header.
      before: "export function g(i: number) {\n--i; spawn(\"sh\");\n  return i;\n}\n",
      after: "export function g(i: number) {\n  return i;\n}\n"
    }
  });
  assert.ok(report.risks["process-spawn"]);
  assert.deepEqual(report.symbols.map((symbol) => symbol.name), ["g"]);
});

test("gates changes to the review skill's scripts with their own test", () => {
  const report = mapAfterCommit({ ".claude/skills/review-change/scripts/x.mjs": { before: "a\n", after: "b\n" } });
  assert.deepEqual(report.gates, ["node --test '.claude/skills/review-change/scripts/*.test.mjs'"]);
});

test("attributes a comment inside a declaration to that declaration", () => {
  const before = "export class Alpha {\n  /**\n   * old\n   */\n  run() {\n    /* step */\n    return 1;\n  }\n}\n";
  const memberDoc = before.replace("   * old", "   * new");
  const bodyComment = before.replace("/* step */", "/* first step */");
  assert.deepEqual(mapAfterEdit(before, memberDoc).symbols.map((symbol) => symbol.name), ["Alpha"]);
  assert.deepEqual(mapAfterEdit(before, bodyComment).symbols.map((symbol) => symbol.name), ["Alpha"]);
});

test("does not charge a top-level statement to the declaration above it", () => {
  const before = "export function alphaFirst() {\n  return 1;\n}\nregister(1);\n";
  const after = before.replace("register(1);", "register(2);");
  assert.deepEqual(mapAfterEdit(before, after).symbols, []);
});

test("attributes an operator-continuation line starting with * to its function", () => {
  const before = "export function area(w: number, h: number) {\n  return w\n    * h;\n}\n";
  const after = before.replace("    * h;", "    * h * 2;");
  assert.deepEqual(mapAfterEdit(before, after).symbols.map((symbol) => symbol.name), ["area"]);
});

test("keeps references for a symbol exported later with export { name }", () => {
  const before = "function betaSecond(x: number) {\n  return x;\n}\nexport { betaSecond };\n";
  const after = before.replace("return x;", "return x * 2;");
  const symbol = mapAfterEdit(before, after).symbols.find((entry) => entry.name === "betaSecond");
  assert.ok(symbol.references.some((ref) => ref.startsWith("career-ops-wrapper/src/b.ts:")));
});

test("attributes a Kotlin member KDoc edit to its class", () => {
  const file = "android/app/src/main/kotlin/a/data/remote/Repo.kt";
  const before = "class Repo {\n    /**\n     * Loads offers.\n     */\n    fun load() = Unit\n}\n";
  const report = mapAfterCommit({ [file]: { before, after: before.replace("Loads offers.", "Loads offers once.") } });
  assert.deepEqual(report.symbols.map((symbol) => symbol.name), ["Repo"]);
});

test("does not charge a doc comment on a top-level statement to the declaration above", () => {
  const before = "export function alphaFirst() {\n  return 1;\n}\n/** Registers the plugin. */\nregister(1);\n";
  const after = before.replace("Registers the plugin.", "Registers the plugin once.");
  assert.deepEqual(mapAfterEdit(before, after).symbols, []);
});

test("attributes a JSDoc separated from its declaration by a // line to that declaration", () => {
  const withNote = [...A_TS.slice(0, 6), "// eslint-disable-next-line no-magic-numbers", ...A_TS.slice(6)];
  const docEdit = withNote.map((line) => (line === " * Doubles x." ? " * Doubles x; throws on NaN." : line));
  const noteEdit = withNote.map((line) => (line.startsWith("// eslint") ? "// eslint-disable-next-line" : line));
  assert.deepEqual(mapAfterEdit(withNote.join("\n"), docEdit.join("\n")).symbols.map((symbol) => symbol.name), ["betaSecond"]);
  assert.deepEqual(mapAfterEdit(withNote.join("\n"), noteEdit.join("\n")).symbols.map((symbol) => symbol.name), ["betaSecond"]);
});

test("keeps references for a $-prefixed symbol exported later with export { $name }", () => {
  const before = "function $double(x: number) {\n  return x * 2;\n}\nexport { $double };\n";
  const report = mapAfterCommit({
    "career-ops-wrapper/src/a.ts": { before, after: before.replace("x * 2", "x + x") },
    "career-ops-wrapper/src/b.ts": { before: "import { $double } from './a.js';\n$double(1);\n", after: "import { $double } from './a.js';\n$double(1);\n" }
  });
  const symbol = report.symbols.find((entry) => entry.name === "$double");
  assert.deepEqual(symbol.reasons, ["body changed"]);
  assert.ok(symbol.references.some((ref) => ref.startsWith("career-ops-wrapper/src/b.ts:")));
});

test("attributes a removed exported declaration from the base tree", () => {
  const after = A_TS.slice(0, 3).join("\n") + "\n";
  const symbol = mapAfterEdit(A_TS.join("\n"), after).symbols.find((entry) => entry.name === "betaSecond");
  assert.ok(symbol.reasons.includes("declaration changed"));
  assert.ok(symbol.references.some((ref) => ref.startsWith("career-ops-wrapper/src/b.ts:")));
});

test("rejects a flag whose value is missing or another flag", () => {
  for (const argv of [["--base", "--json"], ["--base"], ["--base", "HEAD", "--head"], ["--base", "HEAD", "--bogus"]]) {
    const result = spawnSync("node", [script, ...argv], { encoding: "utf8" });
    assert.equal(result.status, 2, `${argv.join(" ")} should be a usage error`);
    assert.match(result.stderr, /usage:/);
  }
});

test("runs Layer 0 and the Spec reviewer only for a docs-only change", () => {
  const report = mapAfterCommit({
    "docs/workflow/backend-delivery.md": { before: "# A\n", after: "# B\n" },
    "README.md": { before: "a\n", after: "b\n" },
    "career-ops-wrapper/README.md": { before: "a\n", after: "b\n" }
  });
  assert.equal(report.mode, "docs-only");
  assert.equal(report.tier, "S");
  assert.deepEqual(report.reviewers, ["spec"]);
  assert.deepEqual(report.gates, []);
});

test("keeps the full review when a Markdown change is not plain documentation", () => {
  const cases = [
    { ".claude/skills/review-change/SKILL.md": { before: "a\n", after: "b\n" } },
    { ".github/pull_request_template.md": { before: "a\n", after: "b\n" } },
    { "career-ops-wrapper/src/notes.md": { before: "a\n", after: "b\n" } },
    { "android/.claude/rules/testing.md": { before: "a\n", after: "b\n" } },
    { "AGENTS.md": { before: "a\n", after: "b\n" } },
    { "android/CLAUDE.md": { before: "a\n", after: "b\n" } },
    { "career-ops-wrapper/fixtures/workspaces/w/data/applications.md": { before: "a\n", after: "b\n" } },
    { "docs/tools/check-links.mjs": { before: "a\n", after: "b\n" } },
    { "docs/ci.yml": { before: "a\n", after: "b\n" } },
    { "docs/a.md": { before: "a\n", after: "b\n" }, "career-ops-wrapper/src/x.ts": { before: "export const a = 1;\n", after: "export const a = 2;\n" } }
  ];
  for (const files of cases) {
    const report = mapAfterCommit(files);
    assert.equal(report.mode, "full", Object.keys(files).join(", "));
    assert.notEqual(report.tier, "S", Object.keys(files).join(", "));
    assert.notDeepEqual(report.reviewers, ["spec"], Object.keys(files).join(", "));
  }
});

test("uses tier M with one standard reviewer for a small change outside high-risk areas", () => {
  const report = mapAfterCommit({
    "career-ops-wrapper/src/services/offer-service.ts": { before: "export function a() {\n  return 1;\n}\n", after: "export function a() {\n  return 2;\n}\n" }
  });
  assert.equal(report.tier, "M");
  assert.deepEqual(report.reviewers, ["standard"]);
  assert.ok(report.tierReasons.length > 0);

  const androidUi = mapAfterCommit({
    "android/app/src/main/kotlin/me/x/ui/home/HomeScreen.kt": { before: "val a = 1\n", after: "val a = 2\n" }
  });
  assert.equal(androidUi.tier, "M");
});

test("uses tier L with the full panel for high-risk areas, contracts, Android, CI and size", () => {
  const big = Array.from({ length: 301 }, (_, i) => `export const v${i} = ${i};`).join("\n") + "\n";
  const cases = [
    { "career-ops-wrapper/src/security/redaction.ts": { before: "export const a = 1;\n", after: "export const a = 2;\n" } },
    { "career-ops-wrapper/src/career-ops-engine/x.ts": { before: "export const a = 1;\n", after: "export const a = 2;\n" } },
    { "career-ops-wrapper/contracts/examples/offer.valid.json": { before: "{}\n", after: "{\"id\":\"o\"}\n" } },
    { ".github/workflows/x.yml": { before: "a: 1\n", after: "a: 2\n" } },
    { "android/app/src/main/kotlin/me/x/data/remote/Api.kt": { before: "val a = 1\n", after: "val a = 2\n" } },
    {
      "android/app/src/main/kotlin/me/x/ui/home/HomeScreen.kt": { before: "val a = 1\n", after: "val a = 2\n" },
      "career-ops-wrapper/src/services/offer-service.ts": { before: "export const a = 1;\n", after: "export const a = 2;\n" }
    },
    { "career-ops-wrapper/src/services/big.ts": { before: "export const z = 0;\n", after: big } }
  ];
  for (const files of cases) {
    const report = mapAfterCommit(files);
    assert.equal(report.tier, "L", Object.keys(files).join(", "));
    assert.deepEqual(report.reviewers.slice(0, 3), ["spec", "impact", "tests"], Object.keys(files).join(", "));
  }
});
