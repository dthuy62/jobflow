import { homedir } from "node:os";
import { redactSensitiveText } from "../security/redaction.js";

export const SCAN_OUTPUT_LINE_MAX_CHARS = 300;

export interface ScanOutputSanitizerOptions {
  /** Configured and real workspace paths; replaced with `[WORKSPACE]`. */
  readonly workspacePaths: readonly string[];
  /** Literal secret values such as the pairing token; replaced with `[REDACTED]`. */
  readonly secrets: readonly string[];
}

const ABSOLUTE_PATH_TOKEN = /(^|[\s"'(=,;])(?:~\/|\/(?!\/)|[A-Za-z]:\\)[^\s"'),;]*/g;

/**
 * Makes one line of scan output safe to return to clients: no tokens, no
 * workspace/home/absolute paths, no `..` segments, no control characters.
 */
export function sanitizeScanOutputLine(line: string, options: ScanOutputSanitizerOptions): string {
  let text = line.replace(/[\t\r\n]+/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ");
  text = redactSensitiveText(text);

  for (const secret of options.secrets) {
    if (secret) {
      text = text.split(secret).join("[REDACTED]");
    }
  }

  const knownPaths = [...options.workspacePaths]
    .filter((value) => value.length > 1)
    .sort((left, right) => right.length - left.length);
  for (const knownPath of knownPaths) {
    text = text.split(knownPath).join("[WORKSPACE]");
  }

  const home = homedir();
  if (home.length > 1) {
    text = text.split(home).join("[HOME]");
  }

  text = text
    .replace(ABSOLUTE_PATH_TOKEN, "$1[PATH]")
    .replace(/\.\.(?=[\\/]|$|\s)[\\/]?/g, "")
    .replace(/ {2,}/g, " ")
    .trim();

  return text.slice(0, SCAN_OUTPUT_LINE_MAX_CHARS);
}
