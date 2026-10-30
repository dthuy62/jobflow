import { createHash } from "node:crypto";
import { listArtifactFiles, type ArtifactFile } from "../outputs/artifact-catalog.js";
import {
  parseApplications,
  parsePipeline,
  parseScanHistory,
  type ParsedPipeline,
  type ScanHistoryRow,
  type TrackerRow
} from "../parsers/index.js";
import { listReportFiles, type ReportFile } from "./report-file-adapter.js";
import { readOptionalWorkspaceText } from "./workspace-reader.js";

export const SCAN_HISTORY_MAX_BYTES = 10 * 1024 * 1024;
export const TRACKER_MARKDOWN_MAX_BYTES = 2 * 1024 * 1024;

export interface CareerOpsData {
  readonly scanHistory: ScanHistoryRow[];
  readonly pipeline: ParsedPipeline;
  readonly tracker: TrackerRow[];
  readonly reports: ReportFile[];
  readonly artifacts: ArtifactFile[];
  /** First 8 hex of a SHA-256 over every source; changes when any source changes. */
  readonly revisionHash: string;
}

/** Reads the Career Ops files the offer/report/artifact projection is built from. */
export async function readCareerOpsData(workspacePath: string): Promise<CareerOpsData> {
  const [scanHistory, pipeline, tracker, reports, artifacts] = await Promise.all([
    readOptionalWorkspaceText(workspacePath, "data/scan-history.tsv", SCAN_HISTORY_MAX_BYTES),
    readOptionalWorkspaceText(workspacePath, "data/pipeline.md", TRACKER_MARKDOWN_MAX_BYTES),
    readOptionalWorkspaceText(workspacePath, "data/applications.md", TRACKER_MARKDOWN_MAX_BYTES),
    listReportFiles(workspacePath),
    listArtifactFiles(workspacePath)
  ]);

  const hash = createHash("sha256");
  for (const source of [scanHistory, pipeline, tracker]) {
    hash.update(source?.content ?? "").update("\0");
  }
  for (const report of reports) {
    hash.update(`${report.fileName}:${report.mtime.getTime()}\0`);
  }
  for (const artifact of artifacts) {
    hash.update(`${artifact.fileName}:${artifact.sizeBytes}:${artifact.mtime.getTime()}\0`);
  }

  return {
    scanHistory: parseScanHistory(scanHistory?.content ?? ""),
    pipeline: parsePipeline(pipeline?.content ?? ""),
    tracker: parseApplications(tracker?.content ?? ""),
    reports,
    artifacts,
    revisionHash: hash.digest("hex").slice(0, 8)
  };
}
