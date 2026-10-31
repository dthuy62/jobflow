export interface ParsedScanOutput {
  readonly offersFound: number;
  readonly offersAdded: number;
  /** Companies `scan.mjs` handed off to an Agent/WebSearch scan. */
  readonly handoffCount: number;
  /** Raw `<company>: <error>` text of each `✗` line. Never returned to clients. */
  readonly errorLines: string[];
}

/** Reads the summary that `scan.mjs` prints to stdout. */
export function parseScanOutput(stdout: string): ParsedScanOutput {
  const errorLines: string[] = [];

  for (const line of stdout.split(/\r?\n/)) {
    const errorLine = line.trim().match(/^✗\s+(.+)$/)?.[1];
    if (errorLine) {
      errorLines.push(errorLine);
    }
  }

  return {
    offersFound: readCount(stdout, /Total jobs found:\s*(\d+)/),
    offersAdded: readCount(stdout, /New offers added:\s*(\d+)/),
    handoffCount: readCount(stdout, /^\s*Agent\/WebSearch handoff:\s*(\d+)/m),
    errorLines
  };
}

function readCount(stdout: string, pattern: RegExp): number {
  const value = stdout.match(pattern)?.[1];
  return value ? Number.parseInt(value, 10) : 0;
}
