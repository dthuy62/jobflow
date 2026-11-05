import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import {
  createCareerOpsEngineAdapter,
  type CareerOpsEngineAdapter,
  type RunScanArgs,
  type ScanProcessResult
} from "../career-ops-engine/career-ops-engine-adapter.js";
import { buildScanWarnings, describeScanFailure, listScanCompanyNames } from "../career-ops-engine/scan-diagnostics.js";
import { DEFAULT_SCAN_TIMEOUT_MS, type RuntimeConfig } from "../config/runtime-config.js";
import type { ScanRunDto, StartScanRunRequestDto } from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import { parseScanOutput } from "../parsers/index.js";
import { ScanRunStore } from "../runs/index.js";
import { createPortalFileAdapter } from "../workspace/portal-file-adapter.js";
import { listWorkspacePathVariants } from "../workspace/workspace-paths.js";
import { createScanReadinessService, type ScanReadinessService } from "./scan-readiness-service.js";

export interface ScanRunService {
  startScan(request: StartScanRunRequestDto): Promise<ScanRunDto>;
  getScanRun(id: string): ScanRunDto;
  getLatestScanRun(): ScanRunDto;
  /** Resolves once no scan is executing. */
  waitForIdle(): Promise<void>;
  /** Terminates a running scan and waits for its run to settle. */
  shutdown(): Promise<void>;
}

export interface ScanRunServiceOptions {
  readonly engine?: CareerOpsEngineAdapter;
  readonly readiness?: ScanReadinessService;
  readonly now?: () => Date;
}

export function createScanRunService(
  config: RuntimeConfig,
  options: ScanRunServiceOptions = {}
): ScanRunService {
  const store = new ScanRunStore();
  const engine = options.engine ?? createCareerOpsEngineAdapter(config.workspace);
  const readiness = options.readiness ?? createScanReadinessService(config);
  const now = options.now ?? (() => new Date());
  const timeoutMs = config.scanTimeoutMs ?? DEFAULT_SCAN_TIMEOUT_MS;
  let execution: Promise<void> = Promise.resolve();
  const shutdownController = new AbortController();

  async function execute(id: string, args: RunScanArgs): Promise<void> {
    let result: ScanProcessResult | undefined;
    try {
      result = await engine.runScan({ args, timeoutMs, signal: shutdownController.signal });
    } catch {
      result = undefined;
    }

    store.update(id, { stage: "parsing" });
    const companies = await readScanCompanyNames(config);
    store.update(id, finalRunPatch(result, args, timeoutMs, companies, now()));
  }

  return {
    async startScan(request: StartScanRunRequestDto): Promise<ScanRunDto> {
      const active = store.active();
      if (active) {
        throw new ApiError("SCAN_ALREADY_RUNNING", "A scan is already running.", {
          activeScanRunId: active.id
        });
      }

      const id = newScanRunId(now());
      store.put({
        id,
        status: "pending",
        stage: "queued",
        startedAt: null,
        finishedAt: null,
        exitCode: null,
        active: true,
        summary: { offersFound: 0, offersProjected: 0, warnings: [] },
        failure: null
      });

      try {
        const scanReadiness = await readiness.getScanReadiness();
        if (!scanReadiness.canStartScan) {
          throw new ApiError("WORKSPACE_UNHEALTHY", "Career Ops scan is not ready.", {
            reason: "scan-not-ready",
            missingRequirements: scanReadiness.missingRequirements
          });
        }
      } catch (error) {
        store.delete(id);
        throw error;
      }

      const args: RunScanArgs = {
        dryRun: request.dryRun,
        ...(request.company !== undefined ? { company: request.company } : {})
      };
      const running = store.update(id, {
        status: "running",
        stage: "executing",
        startedAt: now().toISOString()
      }) as ScanRunDto;
      execution = execute(id, args);
      return running;
    },

    getScanRun(id: string): ScanRunDto {
      const run = store.get(id);
      if (!run) {
        throw scanRunNotFound();
      }
      return run;
    },

    getLatestScanRun(): ScanRunDto {
      const run = store.latest();
      if (!run) {
        throw scanRunNotFound();
      }
      return run;
    },

    async waitForIdle(): Promise<void> {
      await execution;
    },

    async shutdown(): Promise<void> {
      shutdownController.abort();
      await execution;
    }
  };
}

function finalRunPatch(
  result: ScanProcessResult | undefined,
  args: RunScanArgs,
  timeoutMs: number,
  companies: readonly string[],
  finishedAt: Date
): Partial<ScanRunDto> {
  const parsed = parseScanOutput(result?.stdout ?? "");
  const failure = describeScanFailure(result, timeoutMs);

  return {
    status: failure ? "failed" : "succeeded",
    stage: failure ? "failed" : "completed",
    active: false,
    finishedAt: finishedAt.toISOString(),
    exitCode: result?.exitCode ?? null,
    summary: {
      offersFound: parsed.offersFound,
      // scan.mjs writes new rows before it prints the summary, so a failed run
      // may still have added offers. A dry run writes nothing.
      offersProjected: args.dryRun ? 0 : parsed.offersAdded,
      warnings: buildScanWarnings(parsed, companies)
    },
    failure
  };
}

/** Company names from portals.yml; none when it cannot be read. */
async function readScanCompanyNames(config: RuntimeConfig): Promise<string[]> {
  try {
    const file = await createPortalFileAdapter(config.workspace).readPortalConfig();
    return listScanCompanyNames(file.parsedPortal, {
      localValues: [homedir(), ...(await listWorkspacePathVariants(config.workspace))],
      secrets: config.pairingToken ? [config.pairingToken] : []
    });
  } catch {
    return [];
  }
}

function newScanRunId(date: Date): string {
  const stamp = date.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `scan_${stamp}_${randomBytes(3).toString("hex")}`;
}

function scanRunNotFound(): ApiError {
  return new ApiError("NOT_FOUND", "Scan run was not found.");
}
