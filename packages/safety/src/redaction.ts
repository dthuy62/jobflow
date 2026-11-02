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
/** Room past the cap for the end of a secret, so its patterns still match before the cut. */
const LOG_TEXT_LOOKAHEAD_CHARS = 4 * 1024;

/**
 * For log lines and error messages, never for text a user reads: it over-redacts
 * on purpose. This is reasonable protection for secrets written plainly, not a
 * guarantee against obfuscated ones; logs must still not be given secrets. The
 * length cap bounds the work the patterns can do on hostile text.
 */
export function redactLogText(value: string): string {
  const redacted = redactSensitiveText(value.slice(0, LOG_TEXT_MAX_CHARS + LOG_TEXT_LOOKAHEAD_CHARS))
    // A quoted value ends at its closing quote; an unquoted header runs to the end of the line.
    .replace(/(authorization\\*["']?\s*[:=,][[\s]*\\*["'])((?:Bearer|Basic|Token)\s+)?[^"'\\\r\n]+/gi, `$1$2${REDACTED}`)
    .replace(/(authorization\\*["']?\s*[:=](?![ \t]*["'\\[])[ \t]*)((?:Bearer|Basic|Token)[ \t]+)?[^\r\n]+/gi, `$1$2${REDACTED}`)
    .replace(/\b(Bearer\s+)(?!\[REDACTED\])[A-Za-z0-9._~+/=-]{8,}/gi, `$1${REDACTED}`)
    // Passwords in connection strings may hold raw slashes; a web URL's port must not look like one.
    .replace(/(?<!https?)(:\/\/[^:\s/?#]*:)\S{1,1024}(?=@)/gi, `$1${REDACTED}`)
    .replace(/(\bhttps?:\/\/[^:\s/?#]*:)[^\s/?#]+(?=@)/gi, `$1${REDACTED}`)
    .replace(/((?:password|passwd|pwd|secret|api[_-]?key|token)\w{0,32}\\*["']?\s*[=:][\s\\"']*)[^&\s"'\\,}]+/gi, `$1${REDACTED}`);
  if (redacted.length <= LOG_TEXT_MAX_CHARS) return redacted;
  // Drop the token at the cut: it may be part of a secret no pattern could see whole.
  return `${redacted.slice(0, LOG_TEXT_MAX_CHARS).replace(/\S*$/, "")}...[truncated]`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
