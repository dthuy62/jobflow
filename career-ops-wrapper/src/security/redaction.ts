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
