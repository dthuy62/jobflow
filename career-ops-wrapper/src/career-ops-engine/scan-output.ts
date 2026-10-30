import { redactLocalValues, type LocalValueRedactionOptions } from "../security/redaction.js";

export const SCAN_OUTPUT_LINE_MAX_CHARS = 300;

export type ScanOutputSanitizerOptions = LocalValueRedactionOptions;

const ABSOLUTE_PATH_TOKEN = /(^|[\s"'(=,;])(?:~\/|\/(?!\/)|[A-Za-z]:\\)[^\s"'),;]*/g;

/**
 * Makes one line of scan output safe to return to clients: no tokens, no
 * workspace/home/absolute paths, no `..` segments, no control characters.
 */
export function sanitizeScanOutputLine(line: string, options: ScanOutputSanitizerOptions): string {
  let text = line.replace(/[\t\r\n]+/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ");
  text = redactLocalValues(text, options);

  text = text
    .replace(ABSOLUTE_PATH_TOKEN, "$1[PATH]")
    .replace(/\.\.(?=[\\/]|$|\s)[\\/]?/g, "")
    .replace(/ {2,}/g, " ")
    .trim();

  return text.slice(0, SCAN_OUTPUT_LINE_MAX_CHARS);
}
