import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { EvaluationModelOutput, OfferDto } from "../src/contracts/index.js";
import {
  EvaluationWriteError,
  buildReportMarkdown,
  cleanTrackerCell,
  slugifyCompany,
  stripHeaderLines,
  writeEvaluation,
  type ScriptRunner
} from "../src/evaluation/evaluation-writer.js";
import { parseReportHeader } from "../src/parsers/report-parser.js";
import type { ProcessResult } from "../src/process/bounded-process.js";
import { writeWorkspaceFileSafely } from "../src/workspace/safe-file-adapter.js";
import { createOfferService } from "../src/services/offer-service.js";
import { copyProjectionFixture, removeWorkspaces } from "./support/fixture-workspace.js";

const workspaces: string[] = [];
afterEach(async () => removeWorkspaces(workspaces));

async function workspace(): Promise<string> {
  const dir = await copyProjectionFixture();
  workspaces.push(dir);
  return dir;
}

const DATE = new Date(2026, 9, 31, 12, 0, 0);

const output: EvaluationModelOutput = {
  score: 4.25,
  legitimacy: "Proceed with Caution",
  note: "Good fit | but\nwatch comp",
  reportMarkdown: [
    "## A) Role Summary",
    "**URL:** https://evil.example/phish",
    "  **score:** 5/5",
    "**PDF:** output/cv-evil.pdf",
    "# Evaluation: Evil — Takeover",
    "Body text that stays.",
    "x".repeat(200)
  ].join("\n")
};

function offer(overrides: Partial<OfferDto> = {}): OfferDto {
  return {
    id: "offer_test",
    company: "Wayne | Enterprises\nLtd",
    title: "Android\tEngineer",
    url: "https://jobs.example.com/wayne/android",
    location: "Remote",
    source: "greenhouse",
    status: "new",
    workMode: "remote",
    evaluationStatus: "notEvaluated",
    artifactIds: [],
    warnings: [],
    ...overrides
  };
}

function ok(stdout = ""): ProcessResult {
  return { exitCode: 0, signal: null, timedOut: false, spawnFailed: false, outputTooLarge: false, stdout, stderr: "" };
}

async function listReports(dir: string): Promise<string[]> {
  return (await readdir(path.join(dir, "reports"))).sort();
}

describe("report building", () => {
  it("drops header-like lines and title headings from the model body, whatever their case or indent", () => {
    expect(stripHeaderLines(output.reportMarkdown)).not.toMatch(/evil|\*\*score/i);
    expect(stripHeaderLines(output.reportMarkdown)).toContain("Body text that stays.");
  });

  it("builds a header from the projection, so the parsed header is always the offer's", () => {
    const markdown = buildReportMarkdown({
      offer: offer(),
      output,
      scoreText: "4.3/5",
      date: "2026-10-31",
      provider: "claude"
    });
    const header = parseReportHeader(markdown);

    expect(header).toMatchObject({
      kind: "evaluation",
      url: "https://jobs.example.com/wayne/android",
      scoreText: "4.3/5",
      date: "2026-10-31"
    });
    expect(header.pdfFileName).toBeUndefined();
    expect(markdown.split("\n")[0]).toBe("# Evaluation: Wayne Enterprises Ltd — Android Engineer");
  });

  it("slugs and cleans", () => {
    expect(slugifyCompany("Wayne | Enterprises\nLtd")).toBe("wayne-enterprises-ltd");
    expect(slugifyCompany("日本")).toBe("offer");
    expect(slugifyCompany("A".repeat(80))).toHaveLength(40);
    expect(cleanTrackerCell("a | b\tc\r\nd")).toBe("a b c d");
  });
});

describe("writeEvaluation", () => {
  it("writes one report, releases the sentinel and merges one tracker row", async () => {
    const dir = await workspace();
    await mkdir(path.join(dir, "batch/tracker-additions"), { recursive: true });
    await writeFile(path.join(dir, "batch/tracker-additions/user-own.tsv"), "keep me");

    const result = await writeEvaluation({
      workspace: dir,
      offer: offer(),
      output,
      provider: "claude",
      date: DATE
    });

    expect(result).toEqual({
      reportFileName: "004-wayne-enterprises-ltd-2026-10-31.md",
      scoreText: "4.3/5",
      warnings: []
    });
    expect(await listReports(dir)).toEqual([
      "001-acme-robotics-2026-06-20.md",
      "002-globex-labs-2026-06-21.md",
      "003-umbrella-mobile.md",
      "004-wayne-enterprises-ltd-2026-10-31.md",
      "README.txt"
    ]);
    const tracker = await readFile(path.join(dir, "data/applications.md"), "utf8");
    expect(tracker.trimEnd().split("\n").at(-1)).toBe(
      "| 4 | 2026-10-31 | Wayne Enterprises Ltd | Android Engineer | 4.3/5 | Evaluated | ❌ | [004](../reports/004-wayne-enterprises-ltd-2026-10-31.md) | Good fit but watch comp |"
    );
    expect(await readFile(path.join(dir, "batch/tracker-additions/user-own.tsv"), "utf8")).toBe("keep me");

    const offers = await createOfferService({ host: "127.0.0.1", port: 3000, workspace: dir }).listOffers();
    const projected = offers.items.find((item) => item.url === "https://jobs.example.com/wayne/android");
    expect(projected).toMatchObject({ evaluationStatus: "evaluated", score: 86, status: "tracked" });
  });

  it("does not touch the tracker when it already has a row for the same company and role", async () => {
    const dir = await workspace();
    const { appendFile } = await import("node:fs/promises");
    await appendFile(
      path.join(dir, "data/applications.md"),
      "| 4 | 2026-10-01 | wayne enterprises ltd | Android  Engineer | | Applied | ❌ | | mine |\n"
    );
    const before = await readFile(path.join(dir, "data/applications.md"), "utf8");

    const result = await writeEvaluation({
      workspace: dir,
      offer: offer(),
      output,
      provider: "claude",
      date: DATE
    });

    expect(result.warnings).toEqual(["The offer is already in the tracker; it was not changed."]);
    expect(await readFile(path.join(dir, "data/applications.md"), "utf8")).toBe(before);
  });

  it("warns when merge-tracker skips or updates instead of adding", async () => {
    const dir = await workspace();
    const runScript = (stdout: string): ScriptRunner => async (script, args) =>
      script === "merge-tracker.mjs" ? ok(stdout) : defaultScripts(dir)(script, args);

    const skipped = await writeEvaluation({
      workspace: dir,
      offer: offer(),
      output,
      provider: "claude",
      date: DATE,
      runScript: runScript("⏭️  Skip: Wayne — Android (existing #2)")
    });
    expect(skipped.warnings).toEqual(["The tracker already had a similar row; no row was added."]);

    const updated = await writeEvaluation({
      workspace: dir,
      offer: offer({ url: "https://jobs.example.com/wayne/other" }),
      output,
      provider: "claude",
      date: DATE,
      runScript: runScript("🔄 Update: #2 Wayne — Android")
    });
    expect(updated.warnings).toEqual(["The tracker updated a similar existing row instead of adding one."]);

    const failed = await writeEvaluation({
      workspace: dir,
      offer: offer({ url: "https://jobs.example.com/wayne/third" }),
      output,
      provider: "claude",
      date: DATE,
      runScript: async (script, args) =>
        script === "merge-tracker.mjs" ? { ...ok(), exitCode: 1 } : defaultScripts(dir)(script, args)
    });
    expect(failed.warnings).toEqual(["The tracker could not be updated; the report was saved."]);
  });

  it("removes the sentinel itself when the release script fails", async () => {
    const dir = await workspace();

    await writeEvaluation({
      workspace: dir,
      offer: offer(),
      output,
      provider: "claude",
      date: DATE,
      runScript: async (script, args) =>
        args[0] === "--release" ? { ...ok(), exitCode: 1 } : defaultScripts(dir)(script, args)
    });

    expect((await listReports(dir)).filter((name) => name.includes("RESERVED"))).toEqual([]);
  });

  it("handles report numbers past 999", async () => {
    const dir = await workspace();
    await writeFile(path.join(dir, "reports/999-old-2026-01-01.md"), "# Evaluation: Old — Role\n");

    const result = await writeEvaluation({
      workspace: dir,
      offer: offer(),
      output,
      provider: "claude",
      date: DATE
    });

    expect(result.reportFileName).toBe("1000-wayne-enterprises-ltd-2026-10-31.md");
    expect((await listReports(dir)).filter((name) => name.includes("RESERVED"))).toEqual([]);
  });

  it("fails without writing when the report file already exists, and still releases", async () => {
    const dir = await workspace();
    await writeFile(path.join(dir, "reports/004-wayne-enterprises-ltd-2026-10-31.md"), "existing");
    const runScript: ScriptRunner = async (script, args) => {
      if (script === "reserve-report-num.mjs" && args.length === 0) {
        await writeFile(path.join(dir, "reports/004-RESERVED.md"), "");
        return ok("004\n");
      }
      return defaultScripts(dir)(script, args);
    };

    await expect(
      writeEvaluation({ workspace: dir, offer: offer(), output, provider: "claude", date: DATE, runScript })
    ).rejects.toBeInstanceOf(EvaluationWriteError);

    expect(await readFile(path.join(dir, "reports/004-wayne-enterprises-ltd-2026-10-31.md"), "utf8")).toBe("existing");
    expect((await listReports(dir)).filter((name) => name.includes("RESERVED"))).toEqual([]);
  });

  it("removes a sentinel the reserve script created before it failed", async () => {
    const dir = await workspace();
    const runScript: ScriptRunner = async (script, args) => {
      if (script === "reserve-report-num.mjs" && args.length === 0) {
        await writeFile(path.join(dir, "reports/004-RESERVED.md"), "");
        return { ...ok(), timedOut: true, exitCode: null };
      }
      return defaultScripts(dir)(script, args);
    };

    await expect(
      writeEvaluation({ workspace: dir, offer: offer(), output, provider: "claude", date: DATE, runScript })
    ).rejects.toBeInstanceOf(EvaluationWriteError);
    expect((await listReports(dir)).filter((name) => name.includes("RESERVED"))).toEqual([]);
  });
});

describe("writeWorkspaceFileSafely createOnly", () => {
  it("creates a new file and refuses to replace an existing one", async () => {
    const dir = await workspace();

    await writeWorkspaceFileSafely({ workspacePath: dir, relativePath: "reports/new.md", content: "one", createOnly: true });
    await expect(
      writeWorkspaceFileSafely({ workspacePath: dir, relativePath: "reports/new.md", content: "two", createOnly: true })
    ).rejects.toThrow();

    expect(await readFile(path.join(dir, "reports/new.md"), "utf8")).toBe("one");
    expect((await readdir(path.join(dir, "reports"))).filter((name) => name.includes(".tmp") || name.endsWith(".bak"))).toEqual([]);
  });
});

/** The writer's own default runner, reached through its public seam. */
function defaultScripts(dir: string): ScriptRunner {
  return async (script, args, extraEnv) => {
    const { createWorkspaceScriptRunner } = await import("../src/evaluation/evaluation-writer.js");
    return createWorkspaceScriptRunner(dir)(script, args, extraEnv);
  };
}
