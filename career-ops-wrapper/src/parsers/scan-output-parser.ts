export interface ParsedScanOutput {
  readonly offersFound: number;
  readonly offersAdded: number;
  readonly warnings: string[];
}

/** Reads the summary that `scan.mjs` prints to stdout. Warnings are not yet redacted. */
export function parseScanOutput(stdout: string): ParsedScanOutput {
  const warnings: string[] = [];

  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("Agent/WebSearch handoff:")) {
      warnings.push(trimmed);
      continue;
    }

    const errorLine = trimmed.match(/^✗\s+(.+)$/)?.[1];
    if (errorLine) {
      warnings.push(errorLine);
    }
  }

  return {
    offersFound: readCount(stdout, /Total jobs found:\s*(\d+)/),
    offersAdded: readCount(stdout, /New offers added:\s*(\d+)/),
    warnings
  };
}

function readCount(stdout: string, pattern: RegExp): number {
  const value = stdout.match(pattern)?.[1];
  return value ? Number.parseInt(value, 10) : 0;
}
