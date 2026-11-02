export const LOG_TEXT_MAX_CHARS = 16 * 1024;
/** Room past the cap, and how far a cut may walk back. Must exceed `URL_PASSWORD_MAX_CHARS`. */
const CUT_BACK_CHARS = 2048;
/** Bounds the work on hostile text; far longer than any real password. */
const URL_PASSWORD_MAX_CHARS = 1024;

const REDACTED = "[REDACTED]";

const URL_PASSWORD = new RegExp(`(:\\/\\/[^:\\s/?#]*:)\\S{1,${URL_PASSWORD_MAX_CHARS}}(?=@)`, "g");
/** Everything after the key, to the end of the line: schemes differ, and over-redacting a log costs nothing. */
const AUTHORIZATION_VALUE = /(authorization\\*["']?\s*(?:[:=]|,(?=\s*\\*["'])))\s*[^\r\n]+/gi;

/**
 * Scrubs what real error messages carry: URL passwords and `Authorization` values. It is not
 * a general secret finder: the serializer below allowlists fields, and code must not log
 * secrets. Never use it on text a user reads, because it over-redacts.
 */
export function redactLogText(text: string): string {
  const workingLength = LOG_TEXT_MAX_CHARS + CUT_BACK_CHARS;
  // Redact past the cap, so a secret that crosses the cap is still seen whole.
  const redacted = text
    .slice(0, workingLength)
    .replace(URL_PASSWORD, `$1${REDACTED}`)
    .replace(AUTHORIZATION_VALUE, `$1 ${REDACTED}`);
  if (text.length <= workingLength && redacted.length <= LOG_TEXT_MAX_CHARS) return redacted;
  return dropCutToken(redacted);
}

/**
 * The token at either cut may be part of a secret no pattern could see whole, even when
 * redaction shrank the text back under the cap. The walk back is bounded, so long text with
 * no spaces survives.
 */
function dropCutToken(text: string): string {
  const head = text.slice(0, LOG_TEXT_MAX_CHARS);
  const floor = Math.max(head.length - CUT_BACK_CHARS, 0);
  let cut = head.length;
  while (cut > floor && !/\s/.test(head.charAt(cut - 1))) cut -= 1;
  return `${head.slice(0, cut)}...[truncated]`;
}

/** An allowlist: driver errors carry fields such as `detail` that can hold user data. */
export function serializeError(error: unknown): { type: string; message: string; stack: string; code?: string } {
  if (!(error instanceof Error)) return { type: "NonError", message: "", stack: "" };
  const { code } = error as { code?: unknown };
  return {
    type: error.name,
    message: redactLogText(error.message),
    stack: redactLogText(error.stack ?? ""),
    ...(typeof code === "string" ? { code } : {})
  };
}
