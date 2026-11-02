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

export const LOG_TEXT_MAX_CHARS = 16 * 1024;

/**
 * For log lines and error messages, never for text a user reads: it over-redacts
 * on purpose. This is reasonable protection for secrets written plainly, not a
 * guarantee against obfuscated ones; logs must still not be given secrets. The
 * length cap keeps these patterns fast on hostile text.
 */
export function redactLogText(value: string): string {
  const capped = value.length > LOG_TEXT_MAX_CHARS ? `${value.slice(0, LOG_TEXT_MAX_CHARS)}...[truncated]` : value;
  return redactSensitiveText(capped)
    .replace(/(\bauthorization\\*["']?\s*[:=,]\s*[[\s\\"']*)((?:Bearer|Basic|Token)\s+)?[^\s"'\\,}\]]+/gi, `$1$2${REDACTED}`)
    .replace(/\b(Bearer\s+)(?!\[REDACTED\])[A-Za-z0-9._~+/=-]{8,}/gi, `$1${REDACTED}`)
    .replace(/(\b(?:postgres(?:ql)?|mysql|mariadb|rediss?|mongodb(?:\+srv)?|amqps?):\/\/[^:\s/?#]*:)\S+(?=@)/gi, `$1${REDACTED}`)
    .replace(/(\bhttps?:\/\/[^:\s/?#]*:)[^\s/?#]+(?=@)/gi, `$1${REDACTED}`)
    .replace(/\b(password|passwd|pwd|secret|api_?key|(?:access|refresh|id)_?token)=[^&\s"',}]+/gi, `$1=${REDACTED}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
