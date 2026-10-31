// Turns a job posting page into plain text for the prompt. It does not need to
// be a faithful renderer: the model only reads the words.
//
// The page is hostile input up to 2 MiB, so this is a single forward scan with
// `indexOf`: every search starts where the last one ended, and an unclosed
// comment, tag or element ends the scan. No backtracking regex runs over the
// raw page, so the time stays linear in its size.

// `head` is not dropped whole, so its JSON-LD scripts are still read; its other
// elements carry no text apart from `title`.
const DROPPED_ELEMENTS = new Set(["script", "style", "noscript", "svg", "title", "template", "iframe"]);
const BLOCK_ELEMENTS = new Set([
  "br",
  "p",
  "div",
  "li",
  "ul",
  "ol",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "tr",
  "table",
  "section",
  "article",
  "header",
  "footer",
  "blockquote",
  "pre",
  "dd",
  "dt"
]);
const TAG_NAME = /^\/?([a-z][a-z0-9-]*)/i;
const JSON_LD_TYPE = /\btype\s*=\s*["']?application\/ld\+json/i;

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
  const { text, jsonLd } = scan(html, true);
  for (const block of jsonLd) {
    const posting = findJobPosting(parseJson(block));
    if (posting) {
      return [posting.title, cleanText(scan(posting.description, false).text)].filter(Boolean).join("\n");
    }
  }
  return cleanText(text);
}

function scan(html: string, collectJsonLd: boolean): { text: string; jsonLd: string[] } {
  const out: string[] = [];
  const jsonLd: string[] = [];
  let position = 0;

  while (position < html.length) {
    const open = html.indexOf("<", position);
    if (open === -1) {
      out.push(html.slice(position));
      break;
    }
    out.push(html.slice(position, open));

    if (html.startsWith("<!--", open)) {
      const close = html.indexOf("-->", open + 4);
      if (close === -1) {
        break;
      }
      position = close + 3;
      continue;
    }

    const name = TAG_NAME.exec(html.slice(open + 1, open + 64))?.[1]?.toLowerCase();
    if (!name) {
      // A bare `<` in text, such as "a < b".
      out.push("<");
      position = open + 1;
      continue;
    }

    const tagEnd = html.indexOf(">", open + 1);
    if (tagEnd === -1) {
      break;
    }
    const isClosing = html[open + 1] === "/";
    position = tagEnd + 1;

    if (!isClosing && DROPPED_ELEMENTS.has(name)) {
      const closing = findClosingTag(html, name, position);
      if (!closing) {
        break;
      }
      if (collectJsonLd && name === "script" && JSON_LD_TYPE.test(html.slice(open, tagEnd))) {
        jsonLd.push(html.slice(position, closing.start));
      }
      position = closing.end;
      continue;
    }

    if (BLOCK_ELEMENTS.has(name)) {
      out.push("\n");
    }
  }

  return { text: out.join(""), jsonLd };
}

/** The next `</name ... >` at or after `from`, case-insensitive. */
function findClosingTag(html: string, name: string, from: number): { start: number; end: number } | undefined {
  const pattern = new RegExp(`</${name}\\b[^<>]*>`, "gi");
  pattern.lastIndex = from;
  const match = pattern.exec(html);
  return match ? { start: match.index, end: match.index + match[0].length } : undefined;
}

function cleanText(text: string): string {
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n");
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (entity, body: string) => {
    if (body.startsWith("#")) {
      const code = body[1]?.toLowerCase() === "x" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? entity;
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
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
