import { describe, expect, it } from "vitest";
import type { ScanProcessResult } from "../src/career-ops-engine/career-ops-engine-adapter.js";
import {
  SCAN_WARNINGS_LIMIT,
  buildScanWarnings,
  classifyScanError,
  describeScanFailure,
  listScanCompanyNames
} from "../src/career-ops-engine/scan-diagnostics.js";
import { SanitizedTextSchema } from "../src/contracts/index.js";
import { parseScanOutput } from "../src/parsers/index.js";

const companies = ["Acme Robotics", "Globex Labs", "Globex"];

function warningsFor(stdout: string, known: readonly string[] = companies): string[] {
  return buildScanWarnings(parseScanOutput(stdout), known);
}

function processResult(overrides: Partial<ScanProcessResult>): ScanProcessResult {
  return { exitCode: 0, signal: null, timedOut: false, spawnFailed: false, stdout: "", stderr: "", ...overrides };
}

// The six round-3 findings from PR #8, plus the inputs earlier rounds fixed.
// Each pairs raw scan text with the substrings that must never reach a client.
const leakCases: ReadonlyArray<readonly [string, string, readonly string[]]> = [
  ["userinfo after '-'", "fetch x-https://jane:hunter2@jobs.example.com/a failed", ["hunter2", "jane", "@"]],
  ["userinfo after '+'", "fetch a+https://jane:hunter2@jobs.example.com/a failed", ["hunter2", "jane", "@"]],
  ["userinfo after '.'", "fetch a.https://jane:hunter2@jobs.example.com/a failed", ["hunter2", "jane", "@"]],
  ["userinfo after a digit", "fetch 1https://jane:hunter2@jobs.example.com/a failed", ["hunter2", "jane", "@"]],
  ["'?' in a password", "fetch https://jane:hunter2?x@jobs.example.com/a failed", ["hunter2", "jane", "@"]],
  ["'#' in a password", "fetch https://jane:hunter2#x@jobs.example.com/a failed", ["hunter2", "jane", "@"]],
  ["sibling workspace folder", "cannot read /Users/jane/career-ops-old/cv.pdf", ["career-ops", "jane", "cv.pdf", "-old"]],
  // Over-redaction, not a leak: the line must still produce a readable warning.
  ["dot run", "retrying...", []],
  ["climb-out after a space", "cannot read /Users/jane/career-ops ../../etc/passwd", ["..", "passwd", "jane"]],
  ["climb-out after a comma", "cannot read /Users/jane/career-ops,../../etc/passwd", ["..", "passwd", "jane"]],
  ["percent-encoded climb-out", "cannot read /Users/jane/career-ops/%2e%2e/%2e%2e/etc/passwd", ["%2e", "passwd", "jane"]],
  ["home path", "cannot read ~/secrets/token.txt", ["~", "secrets", "token.txt"]],
  ["file URL", "load file:///opt/secret/x.js", ["file:", "opt", "secret"]],
  ["Windows path", "missing C:\\Users\\jane\\x.txt", ["C:", "jane"]],
  ["pairing token", "CAREER_OPS_PAIRING_TOKEN=pairing-secret", ["pairing-secret", "CAREER_OPS"]]
];

describe("listScanCompanyNames", () => {
  it("reads tracked company and job board names", () => {
    expect(
      listScanCompanyNames({
        tracked_companies: [{ name: "Acme Robotics" }, { name: "Globex Labs", enabled: false }],
        job_boards: [{ name: "Remote Board" }],
        search_queries: [{ name: "Android" }]
      })
    ).toEqual(["Acme Robotics", "Globex Labs", "Remote Board"]);
  });

  it("drops names that could carry a path, URL, or credential", () => {
    expect(
      listScanCompanyNames({
        tracked_companies: [
          { name: "/Users/jane/career-ops" },
          { name: "https://jane:hunter2@host" },
          { name: "Acme %2e%2e" },
          { name: "Acme?x" },
          { name: "-flag" },
          { name: "x".repeat(101) },
          { name: 42 },
          null,
          { name: "Initech" }
        ]
      })
    ).toEqual(["Initech"]);
  });

  it.each([[undefined], [null], ["text"], [[]], [{ tracked_companies: "x" }]])("returns no names for %j", (portal) => {
    expect(listScanCompanyNames(portal)).toEqual([]);
  });
});

describe("classifyScanError", () => {
  it.each([
    ["request timed out after 30000ms", "timeout"],
    ["ETIMEDOUT", "timeout"],
    ["This operation was aborted", "timeout"],
    ["HTTP 403", "blocked"],
    ["HTTP 429 Too Many Requests", "blocked"],
    ["captcha required", "blocked"],
    ["HTTP 404", "not-found"],
    ["status 410 Gone", "not-found"],
    ["HTTP 503 from careers page", "fetch-failed"],
    ["fetch failed", "fetch-failed"],
    ["getaddrinfo ENOTFOUND jobs.example.com", "fetch-failed"],
    ["Unexpected token < in JSON at position 0", "parse-error"],
    ["greenhouse: fetch() did not return an array", "parse-error"],
    ["greenhouse: invalid URL: x", "config-error"],
    ["lever: URL must use HTTPS: http://x", "config-error"],
    ['workable: untrusted hostname "evil.example"', "config-error"],
    ["local-parser: parser.command is required", "config-error"],
    ["local parser failed, used API fallback: HTTP 503", "api-fallback"],
    ["local parser failed, used API fallback: Unexpected token < in JSON", "api-fallback"],
    ["something odd", "other"],
    ["", "other"]
  ])("classifies %j as %s", (text, category) => {
    expect(classifyScanError(text)).toBe(category);
  });
});

describe("buildScanWarnings", () => {
  it("maps each error line to a known company and a fixed sentence", () => {
    const stdout = [
      "Errors (3):",
      "  ✗ Globex Labs: HTTP 503 from careers page",
      "  ✗ Acme Robotics: request timed out",
      "  ✗ Globex: HTTP 404"
    ].join("\n");

    expect(warningsFor(stdout)).toEqual([
      "Globex Labs: the careers page could not be fetched.",
      "Acme Robotics: the careers page timed out.",
      "Globex: the careers page was not found."
    ]);
  });

  it("reports a local-parser fallback as a fallback, not a failed fetch", () => {
    expect(warningsFor("  ✗ Acme Robotics: local parser failed, used API fallback: HTTP 503")).toEqual([
      "Acme Robotics: the local parser failed, so jobs were fetched through the API instead."
    ]);
  });

  it("matches the longest known name that prefixes the line", () => {
    expect(warningsFor("  ✗ Globex Labs: x")).toEqual(["Globex Labs: the scan failed for this company."]);
  });

  it("matches names exactly, case-sensitive", () => {
    expect(warningsFor("  ✗ acme robotics: HTTP 503")).toEqual([
      "1 scan error could not be matched to a company in portals.yml."
    ]);
  });

  it("drops and counts lines for unknown companies", () => {
    const stdout = ["  ✗ Hooli: HTTP 503", "  ✗ Initech: timeout", "  ✗ Acme Robotics: HTTP 503"].join("\n");

    expect(warningsFor(stdout)).toEqual([
      "Acme Robotics: the careers page could not be fetched.",
      "2 scan errors could not be matched to a company in portals.yml."
    ]);
  });

  it("drops repeats of the same company and category", () => {
    const stdout = ["  ✗ Acme Robotics: HTTP 503", "  ✗ Acme Robotics: HTTP 502", "  ✗ Acme Robotics: timeout"].join("\n");

    expect(warningsFor(stdout)).toEqual([
      "Acme Robotics: the careers page could not be fetched.",
      "Acme Robotics: the careers page timed out."
    ]);
  });

  it("turns the Agent/WebSearch handoff into a count", () => {
    const stdout = [
      "Agent/WebSearch handoff: 3 companies not handled by zero-token providers",
      "  • Initech (websearch) — https://jane:hunter2@jobs.example.com/initech",
      "  ✗ Acme Robotics: HTTP 503"
    ].join("\n");

    expect(warningsFor(stdout)).toEqual([
      "3 companies need an Agent/WebSearch scan.",
      "Acme Robotics: the careers page could not be fetched."
    ]);
    expect(warningsFor("Agent/WebSearch handoff: 1 company not handled by zero-token providers")).toEqual([
      "1 company needs an Agent/WebSearch scan."
    ]);
  });

  it("counts every error line as unmatched when no companies are known", () => {
    expect(warningsFor("  ✗ Acme Robotics: HTTP 503", [])).toEqual([
      "1 scan error could not be matched to a company in portals.yml."
    ]);
  });

  it(`caps warnings at ${SCAN_WARNINGS_LIMIT} and reports how many were omitted`, () => {
    const known = Array.from({ length: 30 }, (_, index) => `Company ${index}`);
    const stdout = known.map((name) => `  ✗ ${name}: HTTP 503`).join("\n");

    const warnings = warningsFor(stdout, known);

    expect(warnings).toHaveLength(SCAN_WARNINGS_LIMIT);
    expect(warnings[SCAN_WARNINGS_LIMIT - 2]).toBe("Company 18: the careers page could not be fetched.");
    expect(warnings.at(-1)).toBe("11 more scan warnings were omitted.");
  });

  it("ignores lines that are not company errors", () => {
    const stdout = [
      "Scanning 2 companies; 0 local parser; 0 skipped — no provider matched via providers",
      "  + Acme Robotics | Android Lead | /Users/jane/career-ops",
      "Results saved to /Users/jane/career-ops/data/pipeline.md and /Users/jane/career-ops/data/scan-history.tsv",
      "⚠️  Skipping entry — missing or non-string 'name' field: {\"url\":\"https://jane:hunter2@host\"}"
    ].join("\n");

    expect(warningsFor(stdout)).toEqual([]);
  });

  describe.each(leakCases)("never returns raw text: %s", (_label, raw, markers) => {
    function expectClean(warnings: readonly string[]): void {
      for (const warning of warnings) {
        expect(SanitizedTextSchema.safeParse(warning).success, warning).toBe(true);
        for (const marker of markers) {
          expect(warning, marker).not.toContain(marker);
        }
      }
    }

    it("as the error text of a known company", () => {
      const warnings = warningsFor(`  ✗ Acme Robotics: ${raw}`);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/^Acme Robotics: the /);
      expectClean(warnings);
    });

    it("as the company part of an error line", () => {
      const warnings = warningsFor(`  ✗ ${raw}: HTTP 503`);
      expect(warnings).toEqual(["1 scan error could not be matched to a company in portals.yml."]);
    });

    it("as a company name in portals.yml", () => {
      const known = listScanCompanyNames({ tracked_companies: [{ name: raw }] });
      expectClean(warningsFor(`  ✗ ${raw}: HTTP 503`, known));
    });

    it("on stderr of a failed run", () => {
      const failure = describeScanFailure(processResult({ exitCode: 1, stdout: raw, stderr: `Fatal: ${raw}` }), 1000);
      expect(failure).toEqual({ code: "COMMAND_FAILED", message: "Career Ops scan exited with code 1." });
    });
  });
});

describe("describeScanFailure", () => {
  it("returns null for a clean exit", () => {
    expect(describeScanFailure(processResult({ stderr: "Fatal: /Users/jane/x" }), 1000)).toBeNull();
  });

  it.each([
    [undefined, { code: "SPAWN_FAILED", message: "Career Ops scan could not be started." }],
    [processResult({ spawnFailed: true, exitCode: null }), { code: "SPAWN_FAILED", message: "Career Ops scan could not be started." }],
    [
      processResult({ timedOut: true, exitCode: null, signal: "SIGTERM" }),
      { code: "COMMAND_TIMEOUT", message: "Career Ops scan exceeded the 600-second timeout." }
    ],
    [
      processResult({ exitCode: null, signal: "SIGKILL" }),
      { code: "COMMAND_FAILED", message: "Career Ops scan was stopped by SIGKILL." }
    ],
    [
      processResult({ exitCode: null, signal: "/Users/jane" }),
      { code: "COMMAND_FAILED", message: "Career Ops scan was stopped by a signal." }
    ],
    [processResult({ exitCode: 3 }), { code: "COMMAND_FAILED", message: "Career Ops scan exited with code 3." }]
  ])("describes %j", (result, expected) => {
    expect(describeScanFailure(result, 600_000)).toEqual(expected);
  });

  it.each([
    ["Error: portals.yml not found. Run onboarding first.", "portals.yml was not found."],
    ["Error: failed to parse portals.yml: bad indentation", "portals.yml could not be parsed."],
    ["⚠️  x\nError: failed to parse /Users/jane/career-ops/portals.yml: bad indentation", "portals.yml could not be parsed."],
    ["Error: no providers loaded from providers/", "No scan providers could be loaded."]
  ])("adds a fixed reason for %j", (stderr, reason) => {
    expect(describeScanFailure(processResult({ exitCode: 1, stderr }), 1000)).toEqual({
      code: "COMMAND_FAILED",
      message: `Career Ops scan exited with code 1. ${reason}`
    });
  });

  it.each([
    ["Fatal: Failed to parse URL from not a url"],
    ['⚠️  greenhouse: detect() threw for "Acme" — Failed to parse URL from x\nFatal: EACCES: permission denied'],
    ["Fatal: Error: portals.yml not found"],
    ["⚠️  local-parser: no providers loaded yet"]
  ])("adds no reason when %j only mentions one in passing", (stderr) => {
    expect(describeScanFailure(processResult({ exitCode: 1, stderr }), 1000)).toEqual({
      code: "COMMAND_FAILED",
      message: "Career Ops scan exited with code 1."
    });
  });
});
