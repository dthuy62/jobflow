import { homedir } from "node:os";


const REDACTED = "[REDACTED]";

export interface RedactionOptions {
  readonly workspacePath?: string;
}

export function redactSensitiveText(value: string, options: RedactionOptions = {}): string {
  const tokenRedacted = value
    .replace(/(X-Career-Ops-Token:\s*)[^,\s}]+/gi, `$1${REDACTED}`)
    .replace(/(CAREER_OPS_PAIRING_TOKEN=)[^\s]+/gi, `$1${REDACTED}`)
    .replace(/("CAREER_OPS_PAIRING_TOKEN"\s*:\s*")[^"]+(")/gi, `$1${REDACTED}$2`);

  if (!options.workspacePath) {
    return tokenRedacted;
  }

  return tokenRedacted.replace(
    new RegExp(escapeRegExp(options.workspacePath), "g"),
    "[WORKSPACE]"
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface LocalValueRedactionOptions {
  /** Configured and real workspace paths; replaced with `[WORKSPACE]`. */
  readonly workspacePaths: readonly string[];
  /** Literal secrets such as the pairing token; replaced with `[REDACTED]`. */
  readonly secrets: readonly string[];
}

/**
 * Redacts token patterns, literal secrets, workspace paths, and the home
 * directory from text that may be returned to clients.
 */
export function redactLocalValues(value: string, options: LocalValueRedactionOptions): string {
  let text = redactSensitiveText(value);

  for (const secret of options.secrets) {
    if (secret) {
      text = text.split(secret).join(REDACTED);
    }
  }

  const workspacePaths = [...options.workspacePaths]
    .filter((candidate) => candidate.length > 1)
    .sort((left, right) => right.length - left.length);
  for (const workspacePath of workspacePaths) {
    text = text.split(workspacePath).join("[WORKSPACE]");
  }

  const home = homedir();
  return home.length > 1 ? text.split(home).join("[HOME]") : text;
}
