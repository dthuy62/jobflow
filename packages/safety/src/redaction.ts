const REDACTED = "[REDACTED]";

export interface RedactionOptions {
  readonly workspacePath?: string;
}

export function redactSensitiveText(value: string, options: RedactionOptions = {}): string {
  const tokenRedacted = value
    .replace(/(X-Career-Ops-Token:\s*)[^,\s}]+/gi, `$1${REDACTED}`)
    .replace(/(CAREER_OPS_PAIRING_TOKEN=)[^\s]+/gi, `$1${REDACTED}`)
    .replace(/("CAREER_OPS_PAIRING_TOKEN"\s*:\s*")[^"]+(")/gi, `$1${REDACTED}$2`)
    .replace(/(\bAuthorization["']?\s*[:=]\s*["']?Bearer\s+)[^\s"',}]+/gi, `$1${REDACTED}`)
    // A fixed scheme list and bounded lengths keep this linear on hostile text.
    .replace(
      /(\b(?:postgres(?:ql)?|mysql|mariadb|rediss?|mongodb(?:\+srv)?|amqps?|https?):\/\/[^:\s/@]{1,256}:)[^\s/]{1,512}(?=@)/gi,
      `$1${REDACTED}`
    );

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
