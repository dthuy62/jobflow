export interface ScanHistoryRow {
  readonly url: string;
  readonly firstSeen: string;
  readonly portal: string;
  readonly title: string;
  readonly company: string;
  readonly status: string;
  readonly location: string;
}

const COLUMNS = ["url", "first_seen", "portal", "title", "company", "status", "location"] as const;

/** Parses `data/scan-history.tsv`; columns are located by header name. */
export function parseScanHistory(tsv: string): ScanHistoryRow[] {
  const [headerLine, ...lines] = tsv.split(/\r?\n/);
  const header = (headerLine ?? "").split("\t").map((name) => name.trim().toLowerCase());
  const index = Object.fromEntries(COLUMNS.map((name) => [name, header.indexOf(name)])) as Record<
    (typeof COLUMNS)[number],
    number
  >;

  return lines.flatMap((line) => {
    const cells = line.split("\t");
    const cell = (name: (typeof COLUMNS)[number]): string =>
      index[name] === -1 ? "" : (cells[index[name]] ?? "").trim();
    const url = cell("url");

    if (!url) {
      return [];
    }

    return [
      {
        url,
        firstSeen: cell("first_seen"),
        portal: cell("portal"),
        title: cell("title"),
        company: cell("company"),
        status: cell("status") || "added",
        location: cell("location")
      }
    ];
  });
}
