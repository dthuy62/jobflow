// Run: node --test '.claude/skills/review-change/scripts/*.test.mjs'
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "tests-prove-change.mjs");

test("rejects a flag whose value is missing or another flag", () => {
  for (const argv of [["--base", "--json"], ["--base"], ["--base", "HEAD", "--head"], ["--base", "HEAD", "--bogus"]]) {
    const result = spawnSync("node", [script, ...argv], { encoding: "utf8" });
    assert.equal(result.status, 2, `${argv.join(" ")} should be a usage error`);
    assert.match(result.stderr, /usage:/);
  }
});
