import { normalizeReportNumber } from "./offer-url.js";

export interface PipelineEntry {
  readonly url: string;
  readonly company?: string;
  readonly title?: string;
  readonly reportNumber?: string;
  readonly scoreText?: string;
}

export interface ParsedPipeline {
  readonly pending: PipelineEntry[];
  readonly processed: PipelineEntry[];
}

const CHECKBOX_LINE = /^\s*-\s*\[([ xX])\]\s+(.+)$/;
const SCORE_CELL = /^\d+(?:\.\d+)?\s*\/\s*5$/;

/**
 * Parses `data/pipeline.md`. `scan.mjs` writes `## Pendientes`/`## Procesadas`;
 * older files use English names. The checkbox decides pending vs processed.
 */
export function parsePipeline(markdown: string): ParsedPipeline {
  const pending: PipelineEntry[] = [];
  const processed: PipelineEntry[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(CHECKBOX_LINE);
    if (!match?.[1] || !match[2]) {
      continue;
    }

    const entry = parseEntry(match[2]);
    if (!entry) {
      continue;
    }

    (match[1] === " " ? pending : processed).push(entry);
  }

  return { pending, processed };
}

function parseEntry(body: string): PipelineEntry | undefined {
  const cells = body.split("|").map((cell) => unescapeMarkdown(cell.trim()));
  let reportNumber: string | undefined;

  if (cells[0]?.startsWith("#")) {
    reportNumber = normalizeReportNumber(cells.shift() ?? "");
  }

  const url = cells.shift()?.split(/\s+/)[0] ?? "";
  if (!/^https?:\/\//i.test(url)) {
    return undefined;
  }

  const [company, title, ...rest] = cells;
  const scoreText = rest.find((cell) => SCORE_CELL.test(cell));

  return {
    url,
    ...(company ? { company } : {}),
    ...(title ? { title } : {}),
    ...(reportNumber ? { reportNumber } : {}),
    ...(scoreText ? { scoreText } : {})
  };
}

function unescapeMarkdown(value: string): string {
  return value.replace(/\\([\\[\]])/g, "$1");
}
