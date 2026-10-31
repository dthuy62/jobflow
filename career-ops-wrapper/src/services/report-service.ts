import { createHash } from "node:crypto";
import type { RuntimeConfig } from "../config/runtime-config.js";
import {
  SanitizedTextSchema,
  type ReportCollectionDto,
  type ReportDetailDto,
  type ReportListItemDto
} from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import { isCalendarDate } from "../parsers/index.js";
import { redactLocalValues } from "../security/redaction.js";
import { readCareerOpsData } from "../workspace/career-ops-data-adapter.js";
import type { ReportFile } from "../workspace/report-file-adapter.js";
import { listWorkspacePathVariants } from "../workspace/workspace-paths.js";
import { projectCareerOps } from "./career-ops-projection.js";

export interface ReportService {
  listReports(): Promise<ReportCollectionDto>;
  getReport(id: string): Promise<ReportDetailDto>;
}

export function createReportService(config: RuntimeConfig): ReportService {
  async function loadReports(): Promise<{ items: ReportListItemDto[]; files: ReportFile[]; revisionHash: string }> {
    const data = await readCareerOpsData(config.workspace, { tolerateOversizedSources: true });
    const { offerIdByReportId } = projectCareerOps(data);
    const files = [...data.reports].reverse();
    return {
      files,
      items: files.map((report) => toListItem(report, offerIdByReportId.get(report.id) ?? null)),
      revisionHash: data.revisionHash
    };
  }

  return {
    async listReports(): Promise<ReportCollectionDto> {
      const { items, revisionHash } = await loadReports();
      return {
        items,
        syncedAt: new Date().toISOString(),
        sourceRevision: `reports_sha256_${revisionHash}`
      };
    },

    async getReport(id: string): Promise<ReportDetailDto> {
      const { items, files } = await loadReports();
      const index = items.findIndex((item) => item.id === id);
      const file = files[index];
      const item = items[index];
      if (!file || !item) {
        throw new ApiError("NOT_FOUND", "Report was not found.");
      }
      if (file.markdown === undefined) {
        throw new ApiError("PAYLOAD_TOO_LARGE", "Report Markdown must be 1 MiB or smaller.");
      }

      const markdown = redactLocalValues(file.markdown, {
        workspacePaths: await listWorkspacePathVariants(config.workspace),
        secrets: config.pairingToken ? [config.pairingToken] : []
      });
      return { ...item, markdown: markdown.trim() === "" ? "(empty report)" : markdown };
    }
  };
}

function toListItem(report: ReportFile, offerId: string | null): ReportListItemDto {
  const date = [report.header.date, report.fileDate].find(isCalendarDate);
  const title = [report.header.title, `Report ${report.number}`].find(
    (candidate) => candidate !== undefined && SanitizedTextSchema.safeParse(candidate).success
  ) as string;
  const revisionSource = report.markdown ?? `${report.fileName}:${report.mtime.getTime()}`;

  return {
    id: report.id,
    offerId,
    title,
    kind: report.header.kind,
    createdAt: date ? `${date}T00:00:00.000Z` : null,
    updatedAt: report.mtime.toISOString(),
    sourceRevision: `report_sha256_${createHash("sha256").update(revisionSource).digest("hex").slice(0, 8)}`
  };
}
