import { SanitizedTextSchema } from "../contracts/index.js";
import { redactLocalValues, type LocalValueRedactionOptions } from "../security/redaction.js";

export const SCAN_OUTPUT_LINE_MAX_CHARS = 300;

export type ScanOutputSanitizerOptions = LocalValueRedactionOptions;

const FILE_URL = /file:\/\/\S*/gi;
// A path starts after any character that cannot continue a word, URL, or path,
// or after `]` unless it closes one of the redaction placeholders.
const ABSOLUTE_PATH_TOKEN =
  /(^|[^\p{L}\p{N}_.~\/\\\]]|(?<!\[(?:WORKSPACE|HOME|PATH|REDACTED))\])(?:~\/|\/(?!\/)|[A-Za-z]:[\\/])[^\s"'),;]*/gu;
const URL_USERINFO = /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi;
const PROTOCOL_RELATIVE_TOKEN = /(^|\s)\/\/\S*/g;
const PARENT_SEGMENT = /\.\.[\\/]/;

/**
 * Makes one line of scan output safe to return to clients: no tokens or URL
 * credentials, no workspace/home/absolute paths, no `..` segments, no control characters.
 * Returns an empty string when nothing readable and safe remains.
 */
export function sanitizeScanOutputLine(line: string, options: ScanOutputSanitizerOptions): string {
  let text = line.replace(/[\t\r\n]+/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ");
  text = redactLocalValues(text, options);

  text = text
    .replace(URL_USERINFO, "$1[REDACTED]@")
    .replace(FILE_URL, "[PATH]")
    .replace(ABSOLUTE_PATH_TOKEN, "$1[PATH]")
    .replace(PROTOCOL_RELATIVE_TOKEN, "$1[PATH]");
  while (PARENT_SEGMENT.test(text)) {
    text = text.replace(PARENT_SEGMENT, "");
  }
  text = text
    .replace(/\.{2,}/g, ".")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, SCAN_OUTPUT_LINE_MAX_CHARS)
    .trim();

  // Drop lines with nothing readable left, or that still look like a local path.
  if (!/[\p{L}\p{N}]/u.test(text) || !SanitizedTextSchema.safeParse(text).success) {
    return "";
  }

  return text;
}
