export interface ReportHeader {
  readonly title?: string;
  readonly kind: "evaluation" | "unknown";
  readonly date?: string;
  readonly url?: string;
  readonly scoreText?: string;
  /** File name inside `output/`, only when the PDF line names `output/<name>.pdf`. */
  readonly pdfFileName?: string;
}

const FIELD_LINE = /^\*\*(Date|URL|Score|PDF):\*\*\s*(.*)$/i;
const OUTPUT_PDF = /^output\/([^/\\]+\.pdf)$/i;

/** Reads the header block of a Career Ops evaluation report. */
export function parseReportHeader(markdown: string): ReportHeader {
  const fields = new Map<string, string>();
  let heading: string | undefined;

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^#\s+(.+)$/);
    if (headingMatch?.[1] && heading === undefined) {
      heading = headingMatch[1].trim();
      continue;
    }

    const fieldMatch = trimmed.match(FIELD_LINE);
    if (fieldMatch?.[1] && fieldMatch[2] && !fields.has(fieldMatch[1].toLowerCase())) {
      fields.set(fieldMatch[1].toLowerCase(), fieldMatch[2].trim());
    }
  }

  const evaluationTitle = heading?.match(/^Evaluation\s*:\s*(.+)$/i)?.[1]?.trim();
  const title = evaluationTitle ?? heading;
  const date = fields.get("date")?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const url = fields.get("url")?.split(/\s+/)[0];
  const scoreText = fields.get("score")?.split(/\s+/)[0];
  const pdfFileName = fields.get("pdf")?.split(/\s+/)[0]?.match(OUTPUT_PDF)?.[1];

  return {
    ...(title ? { title } : {}),
    kind: evaluationTitle ? "evaluation" : "unknown",
    ...(date ? { date } : {}),
    ...(url ? { url } : {}),
    ...(scoreText ? { scoreText } : {}),
    ...(pdfFileName && !pdfFileName.startsWith(".") ? { pdfFileName } : {})
  };
}
