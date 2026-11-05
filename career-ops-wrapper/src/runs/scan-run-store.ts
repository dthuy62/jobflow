import type { ScanRunDto } from "../contracts/index.js";

export const SCAN_RUN_HISTORY_LIMIT = 20;

interface StoredRun {
  readonly id: string;
  readonly active: boolean;
}

/** In-memory registry of runs since wrapper startup; keeps the last {@link SCAN_RUN_HISTORY_LIMIT}. */
export class RunStore<Run extends StoredRun> {
  private readonly runs = new Map<string, Run>();

  active(): Run | undefined {
    return [...this.runs.values()].find((run) => run.active);
  }

  get(id: string): Run | undefined {
    return this.runs.get(id);
  }

  latest(): Run | undefined {
    return [...this.runs.values()].at(-1);
  }

  put(run: Run): Run {
    this.runs.set(run.id, run);
    this.evictOldRuns();
    return run;
  }

  update(id: string, patch: Partial<Run>): Run | undefined {
    const current = this.runs.get(id);
    if (!current) {
      return undefined;
    }
    const next = { ...current, ...patch };
    this.runs.set(id, next);
    return next;
  }

  delete(id: string): void {
    this.runs.delete(id);
  }

  private evictOldRuns(): void {
    for (const [id, run] of this.runs) {
      if (this.runs.size <= SCAN_RUN_HISTORY_LIMIT) {
        return;
      }
      if (!run.active) {
        this.runs.delete(id);
      }
    }
  }
}

/** In-memory registry of scan runs since wrapper startup. */
export class ScanRunStore extends RunStore<ScanRunDto> {}
