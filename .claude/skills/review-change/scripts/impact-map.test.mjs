// Run: node --test .claude/skills/review-change/scripts/impact-map.test.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
