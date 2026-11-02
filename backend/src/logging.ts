export const LOG_TEXT_MAX_CHARS = 16 * 1024;
/** How far the cut may walk back to a space. Past this, the cut drops this many characters instead. */
const CUT_BACK_CHARS = 2048;
/** Bounds the work on hostile text; far longer than any real password. */
const URL_PASSWORD_MAX_CHARS = 1024;

const REDACTED = "[REDACTED]";

const URL_PASSWORD = new RegExp(`(:\\/\\/[^:\\s/?#]*:)\\S{1,${URL_PASSWORD_MAX_CHARS}}(?=@)`, "g");

/**
 * Scrubs what real error messages carry: URL passwords and `Authorization` values. It is not
 * a general secret finder: the serializer below allowlists fields, and code must not log
 * secrets. Never use it on text a user reads, because it over-redacts.
 */
export function redactLogText(text: string): string {
  return capLogText(text)
    .replace(URL_PASSWORD, `$1${REDACTED}`)
    // A quoted value ends at its closing quote.
    .replace(/(authorization\\*["']?\s*[:=,][[\s]*\\*["'])((?:Bearer|Basic|Token)\s+)?[^"'\\\r\n]+/gi, `$1$2${REDACTED}`)
    // An unquoted header value runs to the end of the line, as multi-part schemes do.
    .replace(/(authorization\\*["']?\s*[:=](?![ \t]*["'\\[])[ \t]*)((?:Bearer|Basic|Token)[ \t]+)?[^\r\n]+/gi, `$1$2${REDACTED}`);
}

/**
 * Cuts before redacting and drops the token at the cut, which may be part of a secret that no
 * pattern could then see whole. The walk back is bounded, so long text with no spaces survives.
 */
function capLogText(text: string): string {
  if (text.length <= LOG_TEXT_MAX_CHARS) return text;
  let cut = LOG_TEXT_MAX_CHARS;
  const floor = LOG_TEXT_MAX_CHARS - CUT_BACK_CHARS;
  while (cut > floor && !/\s/.test(text.charAt(cut - 1))) cut -= 1;
  return `${text.slice(0, cut)}...[truncated]`;
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
