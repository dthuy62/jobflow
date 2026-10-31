import path from "node:path";
import { redactSensitiveText } from "./redaction.js";

/**
 * Report Markdown sanitizer. Design: docs/superpowers/specs/2026-10-31-report-markdown-links-design.md.
 *
 * 1. Token patterns and literal secrets become `[REDACTED]`.
 * 2. Links to listed artifacts point at the download route; other local links
 *    are reduced to their text.
 * 3. Every token that is, contains, or continues a local path becomes
 *    `[local path]`. This pass covers the whole document and is the boundary;
 *    pass 2 only improves what the reader sees.
 */

export const LOCAL_PATH_PLACEHOLDER = "[local path]";

export interface ReportMarkdownContext {
  /** Listed `output/` PDFs by file name. */
  readonly artifactIdByFileName: ReadonlyMap<string, string>;
  /** Home directory and workspace path variants; a token containing one is removed. */
  readonly localValues: readonly string[];
  /** Literal secrets such as the pairing token. */
  readonly secrets: readonly string[];
}

/** Stands for `[local path]` while sanitizing, so a placeholder is one whitespace-free token. */
const MARK = "\uE000";

export function sanitizeReportMarkdown(markdown: string, context: ReportMarkdownContext): string {
  let text = redactSensitiveText(markdown.replaceAll(MARK, ""));
  for (const secret of context.secrets) {
    if (secret) {
      text = text.replace(escapedLiteralPattern(secret), "[REDACTED]");
    }
  }

  const localValues = context.localValues.filter((value) => value.length > 1);
  // A value with a space spans tokens, so remove each value with the rest of its token first.
  for (const value of [...localValues].sort((left, right) => right.length - left.length)) {
    text = text.replace(new RegExp(`${escapeRegExp(value)}\\S*`, "giu"), (match) => {
      let end = match.length;
      while (end > value.length && TRAILING.has(match[end - 1] as string)) {
        end -= 1;
      }
      return MARK + match.slice(end);
    });
  }

  const lowerValues = localValues.map((value) => value.toLowerCase());
  const plainValues = lowerValues.map(stripEmphasis);
  const containsLocalValue = (value: string): boolean => {
    const lower = value.toLowerCase();
    const plain = stripEmphasis(lower);
    return lowerValues.some((localValue, index) => lower.includes(localValue) || plain.includes(plainValues[index] as string));
  };

  const linked = rewriteLinks(text, (destination) => classifyDestination(destination, context, containsLocalValue));
  return removeLocalPaths(linked, containsLocalValue).replaceAll(MARK, LOCAL_PATH_PLACEHOLDER);
}

/** Matches `literal` also when Markdown escapes its punctuation (`tok\_x`). */
function escapedLiteralPattern(literal: string): RegExp {
  const pattern = [...literal]
    .map((char) => (ESCAPABLE.test(char) ? `\\\\?${escapeRegExp(char)}` : escapeRegExp(char)))
    .join("");
  return new RegExp(pattern, "gu");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

function stripEmphasis(value: string): string {
  return value.replace(/[*_`]/g, "");
}

// ---------------------------------------------------------------------------
// Pass 2: links

type LinkAction = { readonly kind: "keep" } | { readonly kind: "reduce" } | { readonly kind: "rewrite"; readonly url: string };

const ARTIFACT_DIR = "output/";
const MAX_TITLE_CHARS = 256;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const REFERENCE_DEFINITION = /^ {0,3}\[([^\]\n]{1,999})\]:[ \t]*(<[^<>\n]*>|\S+)(.*)$/;
const ESCAPABLE = /^[!-/:-@[-`{-~]$/;

function classifyDestination(
  rawDestination: string,
  context: ReportMarkdownContext,
  containsLocalValue: (value: string) => boolean
): LinkAction {
  const destination = rawDestination.replace(/\\([!-/:-@[-`{-~])/g, "$1");
  if (destination.includes(MARK)) {
    return { kind: "reduce" };
  }
  if (destination.startsWith("#")) {
    return { kind: "keep" };
  }

  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(destination)?.[1]?.toLowerCase();
  if (scheme !== undefined) {
    const web = scheme === "http" || scheme === "https" || scheme === "mailto";
    return web && !containsLocalValue(destination) && !containsLocalValue(decodeForDetection(destination))
      ? { kind: "keep" }
      : { kind: "reduce" };
  }

  if (destination === "" || /^[/\\~]/.test(destination) || destination.includes("\\")) {
    return { kind: "reduce" };
  }

  let relative: string;
  try {
    relative = decodeURIComponent(destination.split(/[?#]/, 1)[0] ?? "");
  } catch {
    return { kind: "reduce" };
  }
  if (/[\\\0]/.test(relative)) {
    return { kind: "reduce" };
  }

  for (const base of ["reports", "."]) {
    const resolved = path.posix.normalize(path.posix.join(base, relative));
    if (!resolved.startsWith(ARTIFACT_DIR)) {
      continue;
    }
    const fileName = resolved.slice(ARTIFACT_DIR.length);
    const id = fileName.includes("/") ? undefined : context.artifactIdByFileName.get(fileName);
    if (id) {
      return { kind: "rewrite", url: `/api/v1/artifacts/${id}/download` };
    }
  }
  return { kind: "reduce" };
}

/** Applies `classify` to every link and reference definition outside fenced code. */
function rewriteLinks(markdown: string, classify: (destination: string) => LinkAction): string {
  const lines = markdown.split(/(?<=\n)/);
  const output: string[] = [];
  let prose: string[] = [];
  let fence: { char: string; length: number } | undefined;

  const flushProse = (): void => {
    if (prose.length > 0) {
      output.push(rewriteInlineLinks(prose.join(""), classify));
      prose = [];
    }
  };

  for (const line of lines) {
    const content = line.replace(/\r?\n$/, "");
    if (fence) {
      output.push(line);
      const close = FENCE_CLOSE.exec(content);
      if (close?.[1]?.[0] === fence.char && close[1].length >= fence.length) {
        fence = undefined;
      }
      continue;
    }

    const open = FENCE_OPEN.exec(content);
    if (open?.[1] && !(open[1][0] === "`" && open[2]?.includes("`"))) {
      flushProse();
      fence = { char: open[1][0] as string, length: open[1].length };
      output.push(line);
      continue;
    }

    const definition = REFERENCE_DEFINITION.exec(content);
    if (definition?.[2]) {
      const destination = definition[2].startsWith("<") ? definition[2].slice(1, -1) : definition[2];
      const action = classify(destination);
      if (action.kind === "reduce") {
        continue;
      }
      if (action.kind === "rewrite") {
        const start = content.indexOf(definition[2], content.indexOf("]:"));
        prose.push(`${line.slice(0, start)}${action.url}${line.slice(start + definition[2].length)}`);
        continue;
      }
    }
    prose.push(line);
  }

  flushProse();
  return output.join("");
}

interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** Inline links and images in a fence-free chunk. One pass; brackets are matched with a stack. */
function rewriteInlineLinks(text: string, classify: (destination: string) => LinkAction): string {
  const edits: Edit[] = [];
  const openers: Array<{ start: number; image: boolean }> = [];
  const closersByLength = codeSpanClosers(text);

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\" && index + 1 < text.length && ESCAPABLE.test(text[index + 1] as string)) {
      index += 1;
    } else if (char === "`") {
      let end = index;
      while (text[end] === "`") {
        end += 1;
      }
      const close = closersByLength.next(end - index, end);
      index = (close === undefined ? end : close + (end - index)) - 1;
    } else if (char === "\n") {
      // A blank line ends the paragraph, so no link spans it.
      const lineEnd = text.indexOf("\n", index + 1);
      if (/^[ \t]*$/.test(text.slice(index + 1, lineEnd === -1 ? text.length : lineEnd))) {
        openers.length = 0;
      }
    } else if (char === "[") {
      const image = index > 0 && text[index - 1] === "!" && !isEscaped(text, index - 1);
      openers.push({ start: image ? index - 1 : index, image });
    } else if (char === "]") {
      const opener = openers.pop();
      if (!opener || text[index + 1] !== "(") {
        continue;
      }
      const tail = parseInlineTail(text, index + 1);
      if (!tail) {
        continue;
      }
      const action = classify(tail.destination);
      if (action.kind === "rewrite") {
        edits.push({ start: tail.destinationStart, end: tail.destinationEnd, text: action.url });
      } else if (action.kind === "reduce") {
        edits.push({ start: opener.start, end: opener.start + (opener.image ? 2 : 1), text: "" });
        edits.push({ start: index, end: tail.end, text: "" });
      }
      index = tail.end - 1;
    }
  }

  edits.sort((left, right) => left.start - right.start);
  let result = "";
  let cursor = 0;
  for (const edit of edits) {
    result += text.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  return result + text.slice(cursor);
}

function isEscaped(text: string, index: number): boolean {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

/** Finds, for a backtick run, the start of the next run of the same length. */
function codeSpanClosers(text: string): { next(length: number, after: number): number | undefined } {
  const runsByLength = new Map<number, number[]>();
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "`") {
      continue;
    }
    let end = index;
    while (text[end] === "`") {
      end += 1;
    }
    const runs = runsByLength.get(end - index) ?? [];
    runs.push(index);
    runsByLength.set(end - index, runs);
    index = end - 1;
  }

  const cursors = new Map<number, number>();
  return {
    next(length, after) {
      const runs = runsByLength.get(length) ?? [];
      let cursor = cursors.get(length) ?? 0;
      while (cursor < runs.length && (runs[cursor] as number) < after) {
        cursor += 1;
      }
      cursors.set(length, cursor);
      return runs[cursor];
    }
  };
}

interface InlineTail {
  readonly destination: string;
  readonly destinationStart: number;
  readonly destinationEnd: number;
  /** Index just after the closing `)`. */
  readonly end: number;
}

/** Parses `(dest "title")` starting at the `(`. The whole tail must be on one line. */
function parseInlineTail(text: string, open: number): InlineTail | undefined {
  let index = skipSpaces(text, open + 1);
  const destinationStart = index;
  let destination: string;

  if (text[index] === "<") {
    index += 1;
    while (index < text.length && !"<>\n".includes(text[index] as string)) {
      index += text[index] === "\\" ? 2 : 1;
    }
    if (text[index] !== ">") {
      return undefined;
    }
    destination = text.slice(destinationStart + 1, index);
    index += 1;
  } else {
    let depth = 0;
    while (index < text.length) {
      const char = text[index] as string;
      if (char === "\\" && index + 1 < text.length) {
        index += 2;
        continue;
      }
      if (/\s/.test(char) || char.charCodeAt(0) < 0x20 || char === "[" || char === "]" || char === "<") {
        break;
      }
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        if (depth === 0) {
          break;
        }
        depth -= 1;
      }
      index += 1;
    }
    if (depth !== 0) {
      return undefined;
    }
    destination = text.slice(destinationStart, index);
  }
  const destinationEnd = index;

  index = skipSpaces(text, index);
  const quote = text[index];
  if (index > destinationEnd && (quote === '"' || quote === "'" || quote === "(")) {
    const close = quote === "(" ? ")" : quote;
    const limit = Math.min(text.length, index + 1 + MAX_TITLE_CHARS);
    let cursor = index + 1;
    while (cursor < limit && text[cursor] !== close && text[cursor] !== "\n") {
      cursor += text[cursor] === "\\" ? 2 : 1;
    }
    if (text[cursor] !== close) {
      return undefined;
    }
    index = skipSpaces(text, cursor + 1);
  }

  return text[index] === ")" ? { destination, destinationStart, destinationEnd, end: index + 1 } : undefined;
}

function skipSpaces(text: string, index: number): number {
  while (text[index] === " " || text[index] === "\t") {
    index += 1;
  }
  return index;
}

// ---------------------------------------------------------------------------
// Pass 3: local paths

const LEADING = new Set(["(", "[", "{", "<", '"', "'", "*", "_", "`"]);
const TRAILING = new Set([".", ",", ";", ":", "!", "?", ")", "]", "}", ">", '"', "'", "*", "_", "`"]);
/** A character before `/` or `\` that makes it part of a relative word such as `CI/CD`. */
const RELATIVE_BEFORE = /[\p{L}\p{N}\p{M}\p{So}%+#)]/u;
/** A character after a slash run that makes it a path. */
const PATH_AFTER = /[\p{L}\p{N}._~$%{]/u;
const ALPHANUMERIC = /[\p{L}\p{N}]/u;
const ARTIFACT_DOWNLOAD_PATH = /\/api\/v1\/artifacts\/artifact_[a-f0-9]{16}\/download/y;
const HOME_TILDE = /~(?:[A-Za-z][\w.-]*)?[/\\]/y;
const HOME_VARIABLE = /(?:\$HOME|\$\{HOME\})[/\\]|%(?:USERPROFILE|HOMEPATH|HOMEDRIVE|APPDATA|LOCALAPPDATA)%/iy;
const DRIVE_OR_FILE = /[A-Za-z]:[/\\]|file:/iy;
const LINK_BOUNDARY = "](";
/** A system root that starts an absolute path even when glued to a word (`a/Users/bob`). */
const KNOWN_ROOT = /[/\\](?:users|home|private|var|tmp|etc|opt|mnt|volumes|srv|root|usr|cygdrive)[/\\]/iy;

function removeLocalPaths(markdown: string, containsLocalValue: (value: string) => boolean): string {
  const parts = markdown.split(/(\s+)/);
  let previousRemoved = false;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] as string;
    if (index % 2 === 1) {
      if (part.includes("\n")) {
        previousRemoved = false;
      }
      continue;
    }
    if (part === "") {
      continue;
    }
    const result = scrubToken(part, previousRemoved, containsLocalValue);
    parts[index] = result.text;
    previousRemoved = result.removed;
  }
  return parts.join("");
}

interface ScrubResult {
  readonly text: string;
  readonly removed: boolean;
}

function scrubToken(token: string, continuing: boolean, containsLocalValue: (value: string) => boolean): ScrubResult {
  let start = 0;
  while (start < token.length && LEADING.has(token[start] as string)) {
    start += 1;
  }
  let end = token.length;
  while (end > start && TRAILING.has(token[end - 1] as string)) {
    end -= 1;
  }
  const lead = token.slice(0, start);
  const body = token.slice(start, end);
  const trail = token.slice(end);
  if (body === "") {
    return { text: token, removed: false };
  }

  const whole = { text: `${lead}${MARK}${trail}`, removed: true };
  const decoded = decodeForDetection(body);
  if (containsLocalValue(body) || containsLocalValue(decoded)) {
    return whole;
  }
  if (continuing && /[/\\]/.test(decoded)) {
    return whole;
  }

  const scrubbed = scrubBody(body);
  if (scrubbed.climbs) {
    return whole;
  }
  if (scrubbed.removed) {
    return { text: `${lead}${scrubbed.text}${trail}`, removed: true };
  }
  if (decoded !== body) {
    const decodedScrub = scrubBody(decoded);
    if (decodedScrub.removed || decodedScrub.climbs) {
      return whole;
    }
  }
  return { text: `${lead}${scrubbed.text}${trail}`, removed: body.includes(MARK) };
}

/**
 * Removes absolute paths and non-web URLs from a token body, from their start
 * to the end of the body or the next `](`. Web URLs lose their userinfo.
 * `climbs` reports a relative path outside a URL that leaves the workspace.
 */
function scrubBody(body: string): { text: string; removed: boolean; climbs: boolean } {
  let text = "";
  let removed = false;
  let climbs = false;
  let position = 0;
  // Found once and reused until passed, so a long token is scanned in linear time.
  let url = findUrl(body, 0);

  while (position < body.length) {
    if (url && url.start < position) {
      url = findUrl(body, position);
    }
    const limit = url?.start ?? body.length;
    const pathStart = findAbsolutePathStart(body, position, limit);
    const removeFrom = pathStart ?? (url && !url.web ? url.start : undefined);

    if (removeFrom !== undefined) {
      const kept = body.slice(position, removeFrom);
      climbs ||= climbsOutOfWorkspace(kept);
      text += kept + MARK;
      removed = true;
      const next = body.indexOf(LINK_BOUNDARY, removeFrom);
      position = next === -1 ? body.length : next;
      continue;
    }

    const kept = body.slice(position, limit);
    climbs ||= climbsOutOfWorkspace(kept);
    text += kept;
    if (!url) {
      break;
    }
    const next = body.indexOf(LINK_BOUNDARY, url.start);
    const urlEnd = next === -1 ? body.length : next;
    text += stripUserinfo(body.slice(url.start, urlEnd));
    position = urlEnd;
  }

  return { text, removed, climbs };
}

/** The first `scheme://` at or after `from`, starting at the scheme's first letter. */
function findUrl(body: string, from: number): { start: number; web: boolean } | undefined {
  const separator = body.indexOf("://", from);
  if (separator === -1) {
    return undefined;
  }
  let start = separator;
  while (start > from && /[A-Za-z0-9+.-]/.test(body[start - 1] as string)) {
    start -= 1;
  }
  while (start < separator && !/[A-Za-z]/.test(body[start] as string)) {
    start += 1;
  }
  if (start === separator) {
    return { start: separator, web: false };
  }
  const scheme = body.slice(start, separator).toLowerCase();
  return { start, web: scheme === "http" || scheme === "https" };
}

function stripUserinfo(url: string): string {
  const authorityStart = url.indexOf("://") + 3;
  const slash = url.indexOf("/", authorityStart);
  const authority = url.slice(authorityStart, slash === -1 ? url.length : slash);
  const at = authority.lastIndexOf("@");
  return at === -1 ? url : url.slice(0, authorityStart) + url.slice(authorityStart + at + 1);
}

function findAbsolutePathStart(body: string, from: number, to: number): number | undefined {
  for (let index = from; index < to; index += 1) {
    const char = body[index] as string;
    if (char === "/" || char === "\\") {
      let runEnd = index;
      let hasSlash = false;
      while (body[runEnd] === "/" || body[runEnd] === "\\") {
        hasSlash ||= body[runEnd] === "/";
        runEnd += 1;
      }
      const after = body[runEnd] ?? "";
      const isPath = hasSlash ? PATH_AFTER.test(after) : ALPHANUMERIC.test(after);
      KNOWN_ROOT.lastIndex = runEnd - 1;
      if (isPath && (startsPath(body, index) || KNOWN_ROOT.test(body))) {
        const allowed = matchArtifactDownloadPath(body, index);
        if (allowed === undefined) {
          return index;
        }
        index = allowed - 1;
        continue;
      }
      index = runEnd - 1;
    } else if ((char === "~" || char === "$" || char === "%" || /[A-Za-z]/.test(char)) && startsPath(body, index)) {
      const pattern = char === "~" ? HOME_TILDE : char === "$" || char === "%" ? HOME_VARIABLE : DRIVE_OR_FILE;
      pattern.lastIndex = index;
      if (pattern.test(body)) {
        return index;
      }
    }
  }
  return undefined;
}

/** True when the character before `index` (looking past emphasis and backticks) does not glue it to a word. */
function startsPath(body: string, index: number): boolean {
  let cursor = index - 1;
  while (cursor >= 0 && (body[cursor] === "*" || body[cursor] === "_" || body[cursor] === "`")) {
    cursor -= 1;
  }
  if (cursor < 0) {
    return true;
  }
  if (body[cursor] === ".") {
    let dots = 0;
    while (cursor - dots >= 0 && body[cursor - dots] === ".") {
      dots += 1;
    }
    return dots >= 3;
  }
  const code = body.charCodeAt(cursor);
  const previous =
    code >= 0xdc00 && code <= 0xdfff && cursor > 0
      ? String.fromCodePoint(body.codePointAt(cursor - 1) as number)
      : (body[cursor] as string);
  return !RELATIVE_BEFORE.test(previous);
}

/** End of the artifact download path at `index`, when it stands alone. */
function matchArtifactDownloadPath(body: string, index: number): number | undefined {
  ARTIFACT_DOWNLOAD_PATH.lastIndex = index;
  if (!ARTIFACT_DOWNLOAD_PATH.test(body)) {
    return undefined;
  }
  const end = ARTIFACT_DOWNLOAD_PATH.lastIndex;
  const next = body[end] ?? "";
  return next === "" || !(PATH_AFTER.test(next) || next === "/" || next === "\\") ? end : undefined;
}

/** True when a relative path, resolved from `reports/`, leaves the workspace. */
function climbsOutOfWorkspace(text: string): boolean {
  if (!text.includes("..")) {
    return false;
  }
  const segments = text.split(/[/\\]/);
  segments[0] = (segments[0] ?? "").replace(/^.*[^\p{L}\p{N}._~%+-]/u, "");
  let depth = 1;
  for (const segment of segments) {
    if (segment === "" || segment === ".") {
      continue;
    }
    depth += segment === ".." ? -1 : 1;
    if (depth < 0) {
      return true;
    }
  }
  return false;
}

const NAMED_REFERENCES: Readonly<Record<string, string>> = {
  sol: "/",
  bsol: "\\",
  period: ".",
  tilde: "~",
  dollar: "$",
  colon: ":",
  percnt: "%",
  lpar: "(",
  rpar: ")",
  lsqb: "[",
  lbrack: "[",
  rsqb: "]",
  rbrack: "]",
  num: "#",
  amp: "&",
  quot: '"',
  apos: "'"
};

/**
 * Removes Markdown backslash escapes and decodes percent escapes and HTML
 * character references, up to three layers, for detection only.
 */
function decodeForDetection(value: string): string {
  let current = value;
  for (let layer = 0; layer < 3; layer += 1) {
    const next = current
      .replace(/\\([!-/:-@[-`{-~])/g, "$1")
      .replace(/%([0-9A-Fa-f]{2})/g, (_match, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
      .replace(/&#(\d{1,7});/g, (match, decimal: string) => fromCodePoint(Number.parseInt(decimal, 10), match))
      .replace(/&#[xX]([0-9A-Fa-f]{1,6});/g, (match, hex: string) => fromCodePoint(Number.parseInt(hex, 16), match))
      .replace(/&([A-Za-z]{2,6});/g, (match, name: string) => NAMED_REFERENCES[name.toLowerCase()] ?? match);
    if (next === current) {
      break;
    }
    current = next;
  }
  return current;
}

function fromCodePoint(codePoint: number, fallback: string): string {
  return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : fallback;
}
