import type { EvaluationDto } from "../contracts/index.js";
import type { ProcessResult } from "../process/bounded-process.js";
import type { ParsedCliOutput } from "./evaluation-output.js";
import type { PostingFailureReason } from "./posting-fetcher.js";

// CLI output is read here only to pick a category. No text from it is ever
// returned: every failure message is a fixed sentence.

export type EvaluationFailure = NonNullable<EvaluationDto["failure"]>;

// Messages the CLI prints when it is logged out (seen on claude 2.1.309:
// "Failed to authenticate: OAuth session expired and could not be refreshed").
const LOGGED_OUT = /failed to authenticate|not logged in|please run \/login|oauth (?:session|token)|invalid api key|authentication_error/i;
// Same patterns as Career Ops `batch/batch-runner.sh`.
const LIMIT_REACHED =
  /session limit|resets [0-9:]+\s*[ap]m|usage limit|limit\s+reached|rate.?limit|too many requests|\b429\b|quota exceeded/i;

const POSTING_REASONS: Readonly<Record<PostingFailureReason, string>> = {
  "bad-url": "The offer URL is not a plain web address.",
  "blocked-address": "The URL points to a private or local network address.",
  redirect: "The page redirected too often or to an unsafe address.",
  "http-status": "The page answered with an error.",
  "content-type": "The page is not text or HTML.",
  "too-large": "The page is larger than 2 MiB.",
  "too-short": "The page had too little text; it may need JavaScript.",
  timeout: "The page took too long to answer.",
  network: "The page could not be reached."
};

export function describePostingFailure(reason: PostingFailureReason): EvaluationFailure {
  return {
    code: "POSTING_UNAVAILABLE",
    message: `The job posting could not be read from its URL. ${POSTING_REASONS[reason]}`
  };
}

export const CANCELLED_FAILURE: EvaluationFailure = { code: "CANCELLED", message: "AI evaluation was cancelled." };
export const WRITE_FAILED_FAILURE: EvaluationFailure = {
  code: "WRITE_FAILED",
  message: "The evaluation could not be saved to the workspace."
};

/** The failure for a finished CLI run, or `null` when it produced a valid evaluation. */
export function describeEvaluationFailure(
  result: ProcessResult,
  parsed: ParsedCliOutput,
  timeoutMs: number
): EvaluationFailure | null {
  if (result.spawnFailed) {
    return { code: "SPAWN_FAILED", message: "AI CLI could not be started." };
  }
  if (result.timedOut) {
    return {
      code: "COMMAND_TIMEOUT",
      message: `AI evaluation exceeded the ${Math.round(timeoutMs / 1000)}-second timeout.`
    };
  }
  if (result.outputTooLarge) {
    return { code: "OUTPUT_INVALID", message: "AI evaluation returned an unexpected result." };
  }

  const cliText = [result.stderr, parsed.ok ? "" : parsed.kind === "is-error" ? parsed.resultText : result.stdout].join(
    "\n"
  );
  if (result.exitCode !== 0 || (!parsed.ok && parsed.kind === "is-error")) {
    if (LOGGED_OUT.test(cliText)) {
      return { code: "CLI_NOT_LOGGED_IN", message: "The AI CLI on the desktop is not logged in." };
    }
    if (LIMIT_REACHED.test(cliText)) {
      return { code: "CLI_LIMIT_REACHED", message: "The AI CLI usage limit was reached. Try again later." };
    }
  }

  if (result.exitCode !== 0) {
    const signal = result.signal && /^SIG[A-Z0-9]+$/.test(result.signal) ? result.signal : "a signal";
    return {
      code: "COMMAND_FAILED",
      message:
        result.exitCode === null
          ? `AI evaluation was stopped by ${signal}.`
          : `AI evaluation exited with code ${result.exitCode}.`
    };
  }
  if (!parsed.ok) {
    return parsed.kind === "is-error"
      ? { code: "COMMAND_FAILED", message: "AI evaluation reported an error." }
      : { code: "OUTPUT_INVALID", message: "AI evaluation returned an unexpected result." };
  }
  return null;
}
