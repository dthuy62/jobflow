import type { Writable } from "node:stream";
import pino, { type Logger } from "pino";

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
    message: redactLogText(String(error.message)),
    stack: typeof error.stack === "string" ? redactLogText(error.stack) : "",
    ...(typeof code === "string" ? { code } : {})
  };
}

/** One line for a command that failed before logging exists. A failure on several addresses has an empty message. */
export function describeFailure(error: unknown): string {
  const { message, code } = serializeError(error);
  return message || code || "unknown error";
}

const STACK_FRAME_MAX_CHARS = 2048;
const STACK_FRAME = /^\s+at (?:.*\((?:.*:\d+:\d+|<anonymous>|native)\)|\S*:\d+:\d+)$/;

/**
 * For a job that failed: what finds the fault, and no text from the error. Jobs handle CVs and
 * postings, and a parser's or driver's message can quote its input.
 */
export function describeJobFailure(error: unknown): { type: string; code?: string; frames: string } {
  if (!(error instanceof Error)) return { type: "NonError", frames: "" };
  const { code } = error as { code?: unknown };
  const stack = typeof error.stack === "string" ? error.stack : "";
  // The stack holds the message, which can have lines shaped like frames. Cut at the message
  // itself: the header before it varies, as in Node's `AssertionError [ERR_ASSERTION]: `.
  const message = String(error.message);
  const messageAt = message ? stack.indexOf(message) : -1;
  const body = messageAt >= 0 ? stack.slice(messageAt + message.length) : stack;
  const frames = body
    .split("\n")
    // The cap first: the pattern is slow on a very long line, and a real frame is short.
    .filter((line) => line.length <= STACK_FRAME_MAX_CHARS && STACK_FRAME.test(line))
    .join("\n");
  return { type: error.name, ...(typeof code === "string" ? { code } : {}), frames };
}

export function createWorkerLogger(stream?: Writable): Logger {
  return pino({ base: null, serializers: { err: serializeError } }, stream);
}
