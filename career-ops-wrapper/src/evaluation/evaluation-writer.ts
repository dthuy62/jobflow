import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { EvaluationModelOutput, OfferDto } from "../contracts/index.js";
import { parseApplications } from "../parsers/index.js";
import { runBoundedProcess, type ProcessResult } from "../process/bounded-process.js";
import { resolveWorkspaceRelativePath } from "../security/path-guard.js";
import { writeWorkspaceFileSafely } from "../workspace/safe-file-adapter.js";
import { resolveWorkspaceRoot } from "../workspace/workspace-paths.js";
import { readOptionalWorkspaceText } from "../workspace/workspace-reader.js";
import { buildChildEnv } from "./claude-command.js";

// Writes a validated evaluation into the workspace. The model writes nothing:
// the header, file name and tracker cells come from the projection, and only
// the report body and the note come from the model.
//
// Writes, in total: one new `reports/NNN-<slug>-<date>.md`, the
// `reports/NNN-RESERVED.md` sentinel (through `reserve-report-num.mjs`), and
// `data/applications.md` (through `merge-tracker.mjs`).

export type ScriptRunner = (
  script: "reserve-report-num.mjs" | "merge-tracker.mjs",
  args: readonly string[],
  extraEnv?: Readonly<Record<string, string>>
) => Promise<ProcessResult>;

export interface WriteEvaluationInput {
  readonly workspace: string;
  readonly offer: OfferDto;
  readonly output: EvaluationModelOutput;
  readonly provider: "claude";
  readonly date: Date;
  /** The offer already has a `data/applications.md` row: write the report only. */
  readonly hasTrackerRow: boolean;
  readonly runScript?: ScriptRunner;
}

export interface WriteEvaluationResult {
  readonly reportFileName: string;
  /** Rounded once, `X.X/5`; used in the header and the tracker row. */
  readonly scoreText: string;
  readonly warnings: string[];
}

/** The report could not be saved; nothing is left behind. */
export class EvaluationWriteError extends Error {}

export const TRACKER_WARNINGS = {
  alreadyTracked: "The offer is already in the tracker; it was not changed.",
  skipped: "The tracker already had a similar row; no row was added.",
  updated: "The tracker updated a similar existing row instead of adding one.",
  failed: "The tracker could not be updated; the report was saved."
} as const;

const SCRIPT_TIMEOUT_MS: Readonly<Record<string, number>> = {
  "reserve-report-num.mjs": 10_000,
  "merge-tracker.mjs": 30_000
};
const REPORT_NUMBER = /^\d{3,}$/;
const SENTINEL = /^(\d{3,})-RESERVED\.md$/;
const HEADER_FIELD = /^\*\*(Date|URL|Score|PDF|Legitimacy|Evaluated by):\*\*/i;
const TRACKER_MAX_BYTES = 2 * 1024 * 1024;

export async function writeEvaluation(input: WriteEvaluationInput): Promise<WriteEvaluationResult> {
  const runScript = input.runScript ?? createWorkspaceScriptRunner(input.workspace);
  const scoreText = `${(Math.round(input.output.score * 10) / 10).toFixed(1)}/5`;
  const date = formatLocalDate(input.date);

  const reportNumber = await reserveReportNumber(input.workspace, runScript);
  const reportFileName = `${reportNumber}-${slugifyCompany(input.offer.company)}-${date}.md`;
  try {
    await writeWorkspaceFileSafely({
      workspacePath: input.workspace,
      relativePath: `reports/${reportFileName}`,
      content: buildReportMarkdown({ offer: input.offer, output: input.output, scoreText, date, provider: input.provider }),
      createOnly: true
    });
  } catch {
    throw new EvaluationWriteError("report write failed");
  } finally {
    await releaseReportNumber(input.workspace, reportNumber, runScript);
  }

  const warnings = input.hasTrackerRow
    ? [TRACKER_WARNINGS.alreadyTracked]
    : await mergeTrackerRow(input, runScript, { reportNumber, reportFileName, scoreText, date });
  return { reportFileName, scoreText, warnings };
}

export function buildReportMarkdown(input: {
  readonly offer: OfferDto;
  readonly output: EvaluationModelOutput;
  readonly scoreText: string;
  readonly date: string;
  readonly provider: string;
}): string {
  const company = cleanTrackerCell(input.offer.company);
  const title = cleanTrackerCell(input.offer.title);
  return [
    `# Evaluation: ${company} — ${title}`,
    "",
    `**Date:** ${input.date}`,
    `**URL:** ${input.offer.url ?? ""}`,
    `**Score:** ${input.scoreText}`,
    `**Legitimacy:** ${input.output.legitimacy}`,
    "**PDF:** not generated — evaluated from the JobFlow app",
    `**Evaluated by:** JobFlow app (${input.provider})`,
    "",
    "---",
    "",
    stripHeaderLines(input.output.reportMarkdown).trim(),
    ""
  ].join("\n");
}

/** Drops lines the report parser would read as header fields, and level-1 headings. */
export function stripHeaderLines(body: string): string {
  return body
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return !HEADER_FIELD.test(trimmed) && !/^#\s/.test(trimmed);
    })
    .join("\n");
}

export function slugifyCompany(company: string): string {
  const slug = company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return slug === "" ? "offer" : slug;
}

/** One table/TSV cell: no `|`, tabs or line breaks; collapsed spaces. */
export function cleanTrackerCell(value: string): string {
  return value.replace(/[|\t\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

export function createWorkspaceScriptRunner(workspace: string): ScriptRunner {
  return async (script, args, extraEnv = {}) => {
    const scriptPath = await resolveWorkspaceRelativePath(workspace, script);
    return runBoundedProcess({
      command: process.execPath,
      args: [scriptPath, ...args],
      cwd: await resolveWorkspaceRoot(workspace),
      env: buildChildEnv(process.env, extraEnv),
      timeoutMs: SCRIPT_TIMEOUT_MS[script] ?? 10_000
    });
  };
}

async function reserveReportNumber(workspace: string, runScript: ScriptRunner): Promise<string> {
  const before = new Set(await listSentinels(workspace));
  const result = await runScript("reserve-report-num.mjs", []).catch(() => undefined);
  const reportNumber = result?.stdout.trim() ?? "";
  if (result && result.exitCode === 0 && REPORT_NUMBER.test(reportNumber)) {
    return reportNumber;
  }

  // The script may have created a sentinel before failing. Remove it only when
  // exactly one new sentinel appeared, so a desktop session's is never touched.
  const created = (await listSentinels(workspace)).filter((name) => !before.has(name));
  if (created.length === 1 && created[0]) {
    await removeSentinel(workspace, created[0]);
  }
  throw new EvaluationWriteError("report number not reserved");
}

/**
 * Releases the number and makes sure its sentinel is gone: the projection
 * keeps the first file per number in name order, so a left-over
 * `NNN-RESERVED.md` would hide the real report.
 */
async function releaseReportNumber(workspace: string, reportNumber: string, runScript: ScriptRunner): Promise<void> {
  if (reportNumber.length <= 3) {
    await runScript("reserve-report-num.mjs", ["--release", reportNumber]).catch(() => undefined);
  }
  const sentinel = `${reportNumber}-RESERVED.md`;
  if ((await listSentinels(workspace)).includes(sentinel)) {
    await removeSentinel(workspace, sentinel);
  }
}

async function listSentinels(workspace: string): Promise<string[]> {
  try {
    const reports = await resolveWorkspaceRelativePath(workspace, "reports");
    return (await readdir(reports)).filter((name) => SENTINEL.test(name));
  } catch {
    return [];
  }
}

async function removeSentinel(workspace: string, name: string): Promise<void> {
  if (!SENTINEL.test(name)) {
    return;
  }
  try {
    await rm(await resolveWorkspaceRelativePath(workspace, `reports/${name}`), { force: true });
  } catch {
    // Already gone, or outside the workspace (never removed).
  }
}

async function mergeTrackerRow(
  input: WriteEvaluationInput,
  runScript: ScriptRunner,
  report: { reportNumber: string; reportFileName: string; scoreText: string; date: string }
): Promise<string[]> {
  const additions = await mkdtemp(path.join(tmpdir(), "jobflow-tracker-"));
  try {
    const row = [
      String(await nextTrackerNumber(input.workspace)),
      report.date,
      cleanTrackerCell(input.offer.company),
      cleanTrackerCell(input.offer.title),
      "Evaluated",
      report.scoreText,
      "❌",
      `[${report.reportNumber}](reports/${report.reportFileName})`,
      cleanTrackerCell(input.output.note)
    ].join("\t");
    await writeFile(path.join(additions, "jobflow-evaluation.tsv"), `${row}\n`, { flag: "wx" });

    const result = await runScript("merge-tracker.mjs", [], { CAREER_OPS_ADDITIONS: additions });
    if (result.exitCode !== 0) {
      return [TRACKER_WARNINGS.failed];
    }
    if (/^\s*➕ Add\b/m.test(result.stdout)) {
      return [];
    }
    if (/^\s*⏭️?\s*Skip\b/mu.test(result.stdout)) {
      return [TRACKER_WARNINGS.skipped];
    }
    if (/^\s*🔄 Update\b/mu.test(result.stdout)) {
      return [TRACKER_WARNINGS.updated];
    }
    return [TRACKER_WARNINGS.failed];
  } catch {
    return [TRACKER_WARNINGS.failed];
  } finally {
    await rm(additions, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** A hint only: merge-tracker picks the final row number itself. */
async function nextTrackerNumber(workspace: string): Promise<number> {
  const tracker = await readOptionalWorkspaceText(workspace, "data/applications.md", TRACKER_MAX_BYTES).catch(
    () => undefined
  );
  const numbers = parseApplications(tracker?.content ?? "")
    .map((row) => Number(row.number))
    .filter(Number.isFinite);
  return Math.max(0, ...numbers) + 1;
}

function formatLocalDate(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
