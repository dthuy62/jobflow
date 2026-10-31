import { homedir } from "node:os";
import { describe, expect, it } from "vitest";
import { sanitizeScanOutputLine } from "../src/career-ops-engine/scan-output.js";
import { SanitizedTextSchema } from "../src/contracts/index.js";

const options = {
  workspacePaths: ["/Users/jane/career-ops", "/private/var/jane/career-ops"],
  secrets: ["pairing-secret-123"]
};

describe("sanitizeScanOutputLine", () => {
  it.each([
    ["Failed reading /Users/jane/career-ops/portals.yml", "Failed reading [WORKSPACE]/portals.yml"],
    ["at /private/var/jane/career-ops/scan.mjs:10", "at [WORKSPACE]/scan.mjs:10"],
    [`cache in ${homedir()}/.cache/x`, "cache in [HOME]/.cache/x"],
    ["CAREER_OPS_PAIRING_TOKEN=pairing-secret-123", "CAREER_OPS_PAIRING_TOKEN=[REDACTED]"],
    ["echo pairing-secret-123 leaked", "echo [REDACTED] leaked"],
    ["open /etc/passwd failed", "open [PATH] failed"],
    ["see ~/notes.txt", "see [PATH]"],
    ["C:\\Users\\jane\\x.txt missing", "[PATH] missing"],
    ["climb ../../etc", "climb etc"],
    ["Globex: HTTP 503 from https://jobs.example.com/a/b", "Globex: HTTP 503 from https://jobs.example.com/a/b"],
    ["tab\there\u0007bell", "tab here bell"],
    ["Acme: retrying....", "Acme: retrying."],
    ["//cdn.example.com/x.js failed", "[PATH] failed"],
    ["load file:///opt/secret/x.js", "load [PATH]"],
    ["at C:/Users/bob/x", "at [PATH]"],
    ["Error:/opt/secret", "Error:[PATH]"],
    ["at 10:30 https://a.example/b", "at 10:30 https://a.example/b"],
    ["✗ Acme: failed `/opt/secret/creds.json`", "✗ Acme: failed `[PATH]"],
    ["Acme: [/opt/secret/creds.json] missing", "Acme: [[PATH] missing"],
    ["Acme: failed {/opt/secret/creds.json}", "Acme: failed {[PATH]"],
    ["see </etc/passwd>", "see <[PATH]"],
    ["a|/opt/secret/b", "a|[PATH]"],
    ["a+/opt/secret/f", "a+[PATH]"],
    ["a@/opt/secret/d", "a@[PATH]"],
    ["a>/opt/secret/e", "a>[PATH]"],
    ["‘/opt/x’ missing", "‘[PATH] missing"],
    ["x]/opt/secret/g", "x][PATH]"],
    ["[WORKSPACE]/data/a.md and [HOME]/x", "[WORKSPACE]/data/a.md and [HOME]/x"],
    ["see https://jobs.example.com/a/b?x=/c", "see https://jobs.example.com/a/b?x=[PATH]"],
    ["relative data/a.md ok", "relative data/a.md ok"],
    ["✗ acme: fetch https://u:p@host/x failed", "✗ acme: fetch https://[REDACTED]@host/x failed"],
    ["clone git+ssh://tok@github.com/a", "clone git+ssh://[REDACTED]@github.com/a"],
    ["see https://host/a@b and mailto:a@b.com", "see https://host/a@b and mailto:a@b.com"]
  ])("sanitizes %j", (input, expected) => {
    expect(sanitizeScanOutputLine(input, options)).toBe(expected);
  });

  it("truncates long lines to 300 characters", () => {
    expect(sanitizeScanOutputLine("x".repeat(500), options)).toHaveLength(300);
  });

  it("always produces text accepted by SanitizedTextSchema", () => {
    for (const input of ["/abs", "..", "../x", "~/y", "a/../b", "/Users/jane/career-ops", "x....", "....", "//x", ". ./.."]) {
      const output = sanitizeScanOutputLine(input, options);
      expect(output === "" || SanitizedTextSchema.safeParse(output).success, `${input} -> ${output}`).toBe(true);
    }
  });
});
