import {
  SanitizedTextSchema,
  type OfferDto
} from "../contracts/index.js";
import {
  isCalendarDate,
  normalizeOfferUrl,
  offerIdForTrackerNumber,
  offerIdForUrl,
  parseScoreToPercent
} from "../parsers/index.js";
import type { CareerOpsData } from "../workspace/career-ops-data-adapter.js";
import type { ReportFile } from "../workspace/report-file-adapter.js";

export interface CareerOpsProjection {
  /** Sorted by `firstSeenAt` descending, then `id`. */
  readonly offers: OfferDto[];
  readonly offerIdByReportId: ReadonlyMap<string, string>;
  /** Keyed by `output/` file name. */
  readonly reportIdByArtifactFileName: ReadonlyMap<string, string>;
}

type SourceName = "scan-history" | "pipeline" | "tracker" | "report";

const SOURCE_ORDER: readonly SourceName[] = ["scan-history", "pipeline", "tracker", "report"];

interface OfferAccumulator {
  readonly id: string;
  readonly url?: string;
  company?: string | undefined;
  title?: string | undefined;
  location?: string | undefined;
  portal?: string | undefined;
  firstSeen?: string | undefined;
  trackerDate?: string | undefined;
  processed?: boolean | undefined;
  trackerStatus?: string | undefined;
  scoreText?: string | undefined;
  reportNumber?: string | undefined;
  notes?: string | undefined;
  readonly invalidDates: Set<string>;
  readonly sources: Set<SourceName>;
}

/** Career Ops canonical states (`templates/states.yml`) and aliases → `OfferDto.status`. */
const TRACKER_STATUS: Record<string, OfferDto["status"]> = {
  evaluated: "tracked",
  evaluada: "tracked",
  applied: "applied",
  aplicado: "applied",
  aplicada: "applied",
  enviada: "applied",
  sent: "applied",
  responded: "applied",
  respondido: "applied",
  interview: "applied",
  entrevista: "applied",
  offer: "applied",
  oferta: "applied",
  rejected: "rejected",
  rechazado: "rejected",
  rechazada: "rejected",
  discarded: "archived",
  descartado: "archived",
  descartada: "archived",
  cerrada: "archived",
  cancelada: "archived",
  skip: "archived",
  no_aplicar: "archived",
  "no aplicar": "archived",
  monitor: "archived"
};

export function projectCareerOps(data: CareerOpsData): CareerOpsProjection {
  const offers = new Map<string, OfferAccumulator>();
  const reportsByNumber = new Map(data.reports.map((report) => [report.number, report]));

  const accumulatorForUrl = (rawUrl: string): OfferAccumulator | undefined => {
    const url = normalizeOfferUrl(rawUrl);
    if (!url) {
      return undefined;
    }
    return getOrCreate(offers, offerIdForUrl(url), url);
  };

  for (const row of data.scanHistory) {
    if (row.status.toLowerCase() !== "added") {
      continue;
    }
    const offer = accumulatorForUrl(row.url);
    if (!offer) {
      continue;
    }
    offer.sources.add("scan-history");
    offer.company ??= nonEmpty(row.company);
    offer.title ??= nonEmpty(row.title);
    offer.location ??= nonEmpty(row.location);
    offer.portal ??= nonEmpty(row.portal);
    if (checkedDate(offer, row.firstSeen) && (!offer.firstSeen || row.firstSeen < offer.firstSeen)) {
      offer.firstSeen = row.firstSeen;
    }
  }

  for (const [entries, processed] of [
    [data.pipeline.pending, false],
    [data.pipeline.processed, true]
  ] as const) {
    for (const entry of entries) {
      const offer = accumulatorForUrl(entry.url);
      if (!offer) {
        continue;
      }
      offer.sources.add("pipeline");
      offer.processed = offer.processed === true || processed;
      offer.company ??= entry.company;
      offer.title ??= entry.title;
      offer.reportNumber ??= entry.reportNumber;
      offer.scoreText ??= entry.scoreText;
    }
  }

  for (const row of data.tracker) {
    const reportUrl = row.reportNumber ? reportsByNumber.get(row.reportNumber)?.header.url : undefined;
    const offer =
      (reportUrl ? accumulatorForUrl(reportUrl) : undefined) ??
      getOrCreate(offers, offerIdForTrackerNumber(row.number));
    offer.sources.add("tracker");
    offer.company = row.company ?? offer.company;
    offer.title = row.role ?? offer.title;
    offer.trackerStatus = row.status ?? offer.trackerStatus;
    offer.scoreText = row.scoreText ?? offer.scoreText;
    offer.reportNumber = row.reportNumber ?? offer.reportNumber;
    offer.notes = row.notes ?? offer.notes;
    offer.trackerDate ??= checkedDate(offer, row.date) ? row.date : undefined;
  }

  for (const report of data.reports) {
    const offer = report.header.url ? accumulatorForUrl(report.header.url) : undefined;
    if (!offer) {
      continue;
    }
    offer.sources.add("report");
    offer.reportNumber ??= report.number;
    if (!offer.company && !offer.title && report.header.title) {
      const [company, title] = report.header.title.split(/\s*[—–]\s*|\s+--?\s+/, 2);
      offer.company = nonEmpty(company ?? "");
      offer.title = nonEmpty(title ?? "");
    }
  }

  const artifactIdByFileName = new Map(data.artifacts.map((artifact) => [artifact.fileName, artifact.id]));
  const offerIdByReportId = new Map<string, string>();
  const reportIdByArtifactFileName = new Map<string, string>();

  for (const report of data.reports) {
    if (report.header.pdfFileName && artifactIdByFileName.has(report.header.pdfFileName)) {
      reportIdByArtifactFileName.set(report.header.pdfFileName, report.id);
    }
  }

  const projected = [...offers.values()].map((offer) => {
    const report = offer.reportNumber ? reportsByNumber.get(offer.reportNumber) : undefined;
    if (report && !offerIdByReportId.has(report.id)) {
      offerIdByReportId.set(report.id, offer.id);
    }
    return toOfferDto(offer, report, artifactIdByFileName);
  });

  projected.sort(
    (left, right) =>
      (right.firstSeenAt ?? "").localeCompare(left.firstSeenAt ?? "") || left.id.localeCompare(right.id)
  );

  return { offers: projected, offerIdByReportId, reportIdByArtifactFileName };
}

function toOfferDto(
  offer: OfferAccumulator,
  report: ReportFile | undefined,
  artifactIdByFileName: ReadonlyMap<string, string>
): OfferDto {
  const warnings: string[] = [];
  const text = (field: string, value: string | undefined): string | undefined => {
    if (value === undefined) {
      return undefined;
    }
    if (SanitizedTextSchema.safeParse(value).success) {
      return value;
    }
    warnings.push(`${field} omitted: it looked like a local path.`);
    return undefined;
  };

  for (const date of offer.invalidDates) {
    warnings.push(`firstSeenAt omitted: ${date} is not a calendar date.`);
  }

  const score = parseScoreToPercent(offer.scoreText) ?? parseScoreToPercent(report?.header.scoreText);
  const artifactId = report?.header.pdfFileName ? artifactIdByFileName.get(report.header.pdfFileName) : undefined;
  const firstSeen = offer.firstSeen ?? offer.trackerDate;
  const company = text("company", offer.company) ?? "Unknown company";
  const title = text("title", offer.title) ?? "Untitled role";
  const location = text("location", offer.location);
  const source = text("source", offer.portal) ?? "career-ops";
  const notes = text("notes", offer.notes);

  return {
    id: offer.id,
    company,
    title,
    url: offer.url ?? null,
    location: location ?? null,
    source,
    status: statusFor(offer),
    firstSeenAt: firstSeen ? `${firstSeen}T00:00:00.000Z` : null,
    lastSeenAt: null,
    scanRunId: null,
    workMode: workModeFor(location),
    evaluationStatus: score !== null || report ? "evaluated" : "notEvaluated",
    score,
    reportId: report?.id ?? null,
    artifactIds: artifactId ? [artifactId] : [],
    rawSource: SOURCE_ORDER.filter((name) => offer.sources.has(name)).join(", "),
    notes: notes ?? null,
    warnings
  };
}

function statusFor(offer: OfferAccumulator): OfferDto["status"] {
  if (offer.trackerStatus !== undefined) {
    const key = offer.trackerStatus.replace(/\*/g, "").trim().toLowerCase();
    return TRACKER_STATUS[key] ?? "unknown";
  }
  return offer.processed ? "tracked" : "new";
}

function workModeFor(location: string | undefined): OfferDto["workMode"] {
  const value = location?.toLowerCase() ?? "";
  if (value.includes("hybrid")) {
    return "hybrid";
  }
  if (value.includes("remote")) {
    return "remote";
  }
  if (/\bon-?site\b/.test(value)) {
    return "onsite";
  }
  return "unknown";
}

function getOrCreate(offers: Map<string, OfferAccumulator>, id: string, url?: string): OfferAccumulator {
  let offer = offers.get(id);
  if (!offer) {
    offer = { id, ...(url ? { url } : {}), invalidDates: new Set(), sources: new Set() };
    offers.set(id, offer);
  }
  return offer;
}

function nonEmpty(value: string): string | undefined {
  return value.trim() === "" ? undefined : value.trim();
}

/** Records date-shaped values that are not real calendar dates so they surface as warnings. */
function checkedDate(offer: OfferAccumulator, value: string | undefined): value is string {
  if (isCalendarDate(value)) {
    return true;
  }
  if (value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    offer.invalidDates.add(value);
  }
  return false;
}
