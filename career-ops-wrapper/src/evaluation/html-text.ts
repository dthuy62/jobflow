// Turns a job posting page into plain text for the prompt. It does not need to
// be a faithful renderer: the model only reads the words.

const DROPPED_ELEMENTS = /<(script|style|noscript|svg|head|template|iframe)\b[\s\S]*?<\/\1\s*>/gi;
const BLOCK_BOUNDARY =
  /<\s*(?:br|\/?(?:p|div|li|ul|ol|h[1-6]|tr|table|section|article|header|footer|blockquote|pre|dd|dt))\b[^>]*>/gi;
const JSON_LD = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  bull: "•"
};

/** Plain text of an HTML page; prefers a schema.org `JobPosting` description when present. */
export function htmlToText(html: string): string {
  const posting = jobPostingFromJsonLd(html);
  if (posting) {
    return [posting.title, markupToText(posting.description)].filter(Boolean).join("\n");
  }
  return markupToText(html);
}

function markupToText(html: string): string {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(DROPPED_ELEMENTS, "")
    .replace(BLOCK_BOUNDARY, "\n")
    .replace(/<[^>]*>/g, "");

  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n");
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith("#")) {
      const code = body[1]?.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

function jobPostingFromJsonLd(html: string): { title?: string; description: string } | undefined {
  for (const match of html.matchAll(JSON_LD)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1] ?? "");
    } catch {
      continue;
    }
    const posting = findJobPosting(parsed);
    if (posting) {
      return posting;
    }
  }
  return undefined;
}

function findJobPosting(value: unknown): { title?: string; description: string } | undefined {
  const candidates = Array.isArray(value) ? value : [value, (value as { "@graph"?: unknown } | null)?.["@graph"]];
  for (const candidate of candidates.flat()) {
    if (typeof candidate !== "object" || candidate === null) {
      continue;
    }
    const record = candidate as Record<string, unknown>;
    const type = record["@type"];
    const isPosting = type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"));
    if (isPosting && typeof record.description === "string" && record.description.trim() !== "") {
      return {
        ...(typeof record.title === "string" ? { title: record.title.trim() } : {}),
        description: record.description
      };
    }
  }
  return undefined;
}
