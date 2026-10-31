import type { ScanRunDto } from "../contracts/index.js";

export const SCAN_RUN_HISTORY_LIMIT = 20;

/** In-memory registry of scan runs since wrapper startup. */
export class ScanRunStore {
  private readonly runs = new Map<string, ScanRunDto>();

  active(): ScanRunDto | undefined {
    return [...this.runs.values()].find((run) => run.active);
  }

  get(id: string): ScanRunDto | undefined {
    return this.runs.get(id);
  }

  latest(): ScanRunDto | undefined {
    return [...this.runs.values()].at(-1);
  }

  put(run: ScanRunDto): ScanRunDto {
    this.runs.set(run.id, run);
    this.evictOldRuns();
    return run;
  }

  update(id: string, patch: Partial<ScanRunDto>): ScanRunDto | undefined {
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
