import { SanitizedTextSchema, ScanCompanySchema, type ScanRunDto } from "../contracts/index.js";
import type { ParsedScanOutput } from "../parsers/index.js";
import { sanitizeReportMarkdown } from "../security/report-markdown.js";
import type { ScanProcessResult } from "./career-ops-engine-adapter.js";

// Scan output is read here to pick categories and counts, but no text from it
// is ever returned. Warnings and failure messages are built only from company
// names in portals.yml, the categories below, counts, and fixed sentences.

export const SCAN_WARNINGS_LIMIT = 20;

export const SCAN_ERROR_CATEGORIES = [
  "api-fallback",
  "timeout",
  "blocked",
  "not-found",
  "fetch-failed",
  "parse-error",
  "config-error",
  "other"
] as const;

export type ScanErrorCategory = (typeof SCAN_ERROR_CATEGORIES)[number];

// First match wins, so the more specific categories come first.
const CATEGORY_RULES: ReadonlyArray<readonly [Exclude<ScanErrorCategory, "other">, RegExp]> = [
  // scan.mjs reports a local parser that failed over to its API provider as an
  // error, although the company's jobs were fetched.
  ["api-fallback", /^local parser failed, used API fallback\b/i],
  ["timeout", /time[d-]?\s?out|\babort/i],
  ["blocked", /\b(?:401|403|429)\b|forbidden|unauthori[sz]ed|rate.?limit|too many requests|captcha|blocked/i],
  ["not-found", /\b(?:404|410)\b|not\s+found/i],
  [
    "fetch-failed",
    /\b(?:HTTP|status)\s*\d{3}\b|fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|socket|network|certificate|\bTLS\b/i
  ],
  ["parse-error", /JSON|\bpars(?:e|ing)\b|unexpected token|did not return an array/i],
  [
    "config-error",
    /invalid URL|must use HTTPS|must be https?|untrusted hostname|cannot derive|careers_url|is required|requires|escapes the project root/i
  ]
];

const CATEGORY_SENTENCES: Readonly<Record<ScanErrorCategory, string>> = {
  "api-fallback": "the local parser failed, so jobs were fetched through the API instead.",
  timeout: "the careers page timed out.",
  blocked: "the careers page blocked the request.",
  "not-found": "the careers page was not found.",
  "fetch-failed": "the careers page could not be fetched.",
  "parse-error": "the careers page response could not be read.",
  "config-error": "the portal entry is not set up correctly.",
  other: "the scan failed for this company."
};

// Anchored to the exact `Error:` lines scan.mjs prints before exiting.
const FAILURE_REASONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^Error: portals\.ya?ml not found/m, "portals.yml was not found."],
  [/^Error: failed to parse \S*portals\.ya?ml: /m, "portals.yml could not be parsed."],
  [/^Error: no providers loaded/m, "No scan providers could be loaded."]
];

/** Local values and secrets a company name must not echo; see {@link listScanCompanyNames}. */
export interface ScanNameEchoContext {
  /** Home directory and workspace path variants. */
  readonly localValues: readonly string[];
  /** Literal secrets such as the pairing token. */
  readonly secrets: readonly string[];
}

/**
 * Names of the `tracked_companies` and `job_boards` entries in a parsed
 * portals.yml, the lists `scan.mjs` scans. A name is kept when it is a valid
 * {@link ScanCompanySchema} value and the report sanitizer would leave it
 * unchanged, so a warning never echoes a path, URL credential, or token.
 */
export function listScanCompanyNames(
  portal: unknown,
  echo: ScanNameEchoContext = { localValues: [], secrets: [] }
): string[] {
  const root = asRecord(portal);
  const names = [root?.tracked_companies, root?.job_boards]
    .flatMap((entries) => (Array.isArray(entries) ? entries : []))
    .flatMap((entry) => {
      const parsed = ScanCompanySchema.safeParse(asRecord(entry)?.name);
      return parsed.success && isSafeToEcho(parsed.data, echo) ? [parsed.data] : [];
    });

  return [...new Set(names)];
}

function isSafeToEcho(name: string, echo: ScanNameEchoContext): boolean {
  const sanitized = sanitizeReportMarkdown(name, { artifactIdByFileName: new Map(), reportIdByFileName: new Map(), ...echo });
  return sanitized === name && SanitizedTextSchema.safeParse(name).success;
}

export function classifyScanError(text: string): ScanErrorCategory {
  return CATEGORY_RULES.find(([, pattern]) => pattern.test(text))?.[0] ?? "other";
}

/** Client-safe warnings for a scan's parsed output. */
export function buildScanWarnings(parsed: ParsedScanOutput, companies: readonly string[]): string[] {
  const byLength = [...companies].sort((left, right) => right.length - left.length);
  const warnings: string[] = [];

  if (parsed.handoffCount > 0) {
    warnings.push(
      parsed.handoffCount === 1
        ? "1 company needs an Agent/WebSearch scan."
        : `${parsed.handoffCount} companies need an Agent/WebSearch scan.`
    );
  }

  let unmatched = 0;
  for (const line of parsed.errorLines) {
    const company = byLength.find((name) => line.startsWith(`${name}: `));
    if (!company) {
      unmatched += 1;
      continue;
    }

    const category = classifyScanError(line.slice(company.length + 2));
    const warning = `${company}: ${CATEGORY_SENTENCES[category]}`;
    if (!warnings.includes(warning)) {
      warnings.push(warning);
    }
  }

  if (unmatched > 0) {
    warnings.push(
      unmatched === 1
        ? "1 scan error could not be matched to a company in portals.yml."
        : `${unmatched} scan errors could not be matched to a company in portals.yml.`
    );
  }

  if (warnings.length <= SCAN_WARNINGS_LIMIT) {
    return warnings;
  }

  const kept = warnings.slice(0, SCAN_WARNINGS_LIMIT - 1);
  return [...kept, `${warnings.length - kept.length} more scan warnings were omitted.`];
}

/** The run failure for a finished scan process, or `null` when it succeeded. */
export function describeScanFailure(
  result: ScanProcessResult | undefined,
  timeoutMs: number
): ScanRunDto["failure"] {
  if (!result || result.spawnFailed) {
    return { code: "SPAWN_FAILED", message: "Career Ops scan could not be started." };
  }

  if (result.timedOut) {
    return {
      code: "COMMAND_TIMEOUT",
      message: `Career Ops scan exceeded the ${Math.round(timeoutMs / 1000)}-second timeout.`
    };
  }

  if (result.exitCode === 0) {
    return null;
  }

  const signal = result.signal && /^SIG[A-Z0-9]+$/.test(result.signal) ? result.signal : "a signal";
  const exit = result.exitCode === null ? `was stopped by ${signal}` : `exited with code ${result.exitCode}`;
  const reason = FAILURE_REASONS.find(([pattern]) => pattern.test(result.stderr))?.[1];
  return {
    code: "COMMAND_FAILED",
    message: `Career Ops scan ${exit}.${reason ? ` ${reason}` : ""}`
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
