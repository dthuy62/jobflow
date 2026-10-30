import { readFile } from "node:fs/promises";
import { normalizeReportNumber, parseReportHeader, type ReportHeader } from "../parsers/index.js";
import { listWorkspaceFiles } from "./workspace-reader.js";

export const REPORT_MARKDOWN_MAX_BYTES = 1024 * 1024;

const REPORTS_DIR = "reports";
const REPORT_FILE_NAME = /^(\d{1,6})-([A-Za-z0-9][A-Za-z0-9._-]*)\.md$/;

export interface ReportFile {
  readonly id: string;
  readonly number: string;
  readonly fileName: string;
  /** `YYYY-MM-DD` from the file name, when present. */
  readonly fileDate?: string;
  readonly header: ReportHeader;
  /** Undefined when the file is over {@link REPORT_MARKDOWN_MAX_BYTES}. */
  readonly markdown?: string;
  readonly tooLarge: boolean;
  readonly mtime: Date;
}

/**
 * Lists `reports/NNN-<slug>.md` files, newest number last. IDs come from the
 * report number; when two files share a number, the first by file name wins.
 */
export async function listReportFiles(workspacePath: string): Promise<ReportFile[]> {
  const entries = await listWorkspaceFiles(workspacePath, REPORTS_DIR, (name) => REPORT_FILE_NAME.test(name));
  const reports = new Map<string, ReportFile>();

  for (const entry of entries) {
    const number = normalizeReportNumber(entry.name.match(REPORT_FILE_NAME)?.[1] ?? "");
    if (!number || reports.has(number)) {
      continue;
    }

    const tooLarge = entry.sizeBytes > REPORT_MARKDOWN_MAX_BYTES;
    const markdown = tooLarge ? undefined : await readFile(entry.realPath, "utf8").catch(() => undefined);
    if (!tooLarge && markdown === undefined) {
      continue;
    }

    const fileDate = entry.name.match(/(\d{4}-\d{2}-\d{2})\.md$/)?.[1];
    reports.set(number, {
      id: `report_${number}`,
      number,
      fileName: entry.name,
      ...(fileDate ? { fileDate } : {}),
      header: markdown === undefined ? { kind: "unknown" } : parseReportHeader(markdown),
      ...(markdown === undefined ? {} : { markdown }),
      tooLarge,
      mtime: entry.mtime
    });
  }

  return [...reports.values()].sort((left, right) => Number(left.number) - Number(right.number));
}
