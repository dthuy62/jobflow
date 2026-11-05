import { normalizeReportNumber } from "./offer-url.js";

export interface TrackerRow {
  readonly number: string;
  readonly date?: string;
  readonly company?: string;
  readonly role?: string;
  readonly scoreText?: string;
  readonly status?: string;
  readonly reportNumber?: string;
  readonly notes?: string;
}

type TrackerColumn = "number" | "date" | "company" | "role" | "scoreText" | "status" | "report" | "notes";

const HEADER_NAMES: Record<string, TrackerColumn> = {
  "#": "number",
  date: "date",
  company: "company",
  role: "role",
  score: "scoreText",
  status: "status",
  report: "report",
  notes: "notes"
};

/** Parses the `data/applications.md` tracker table; columns are located by header name. */
export function parseApplications(markdown: string): TrackerRow[] {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => isHeaderRow(splitRow(line)));
  if (headerIndex === -1) {
    return [];
  }

  const columns = splitRow(lines[headerIndex] ?? "").map((name) => HEADER_NAMES[name.toLowerCase()]);
  const rows: TrackerRow[] = [];

  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim().startsWith("|")) {
      break;
    }

    const cells = splitRow(line);
    if (cells.every((cell) => /^:?-*:?$/.test(cell))) {
      continue;
    }

    const row = toTrackerRow(columns, cells);
    if (row) {
      rows.push(row);
    }
  }

  return rows;
}

function toTrackerRow(
  columns: readonly (TrackerColumn | undefined)[],
  cells: readonly string[]
): TrackerRow | undefined {
  const values: Partial<Record<TrackerColumn, string>> = {};
  columns.forEach((column, index) => {
    const value = cells[index]?.trim();
    if (column && value) {
      values[column] = value;
    }
  });

  if (!values.number) {
    return undefined;
  }

  const reportNumber = values.report ? reportNumberFromCell(values.report) : undefined;
  const { report: _report, ...fields } = values;

  return {
    ...fields,
    number: values.number,
    ...(reportNumber ? { reportNumber } : {})
  };
}

function reportNumberFromCell(cell: string): string | undefined {
  const linkText = cell.match(/\[#?(\d{1,6})\]/)?.[1];
  const fileNumber = cell.match(/reports\/(\d{1,6})-/)?.[1];
  const value = linkText ?? fileNumber;
  return value ? normalizeReportNumber(value) : undefined;
}

function isHeaderRow(cells: readonly string[]): boolean {
  const names = cells.map((cell) => cell.toLowerCase());
  return names.includes("#") && names.includes("company");
}

function splitRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) {
    return [];
  }

  return trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}
