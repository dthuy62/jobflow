import { randomBytes } from "node:crypto";
import { realpath } from "node:fs/promises";
import path from "node:path";
import {
  createCareerOpsEngineAdapter,
  type CareerOpsEngineAdapter,
  type RunScanArgs,
  type ScanProcessResult
} from "../career-ops-engine/career-ops-engine-adapter.js";
import { sanitizeScanOutputLine } from "../career-ops-engine/scan-output.js";
import { DEFAULT_SCAN_TIMEOUT_MS, type RuntimeConfig } from "../config/runtime-config.js";
import type { ScanRunDto, StartScanRunRequestDto } from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import { parseScanOutput } from "../parsers/index.js";
import { ScanRunStore } from "../runs/index.js";
import { createScanReadinessService, type ScanReadinessService } from "./scan-readiness-service.js";

export const SCAN_WARNINGS_LIMIT = 20;

export interface ScanRunService {
  startScan(request: StartScanRunRequestDto): Promise<ScanRunDto>;
  getScanRun(id: string): ScanRunDto;
  getLatestScanRun(): ScanRunDto;
  /** Resolves once no scan is executing; used by tests and shutdown. */
  waitForIdle(): Promise<void>;
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

  async function execute(id: string, args: RunScanArgs): Promise<void> {
    let result: ScanProcessResult | undefined;
    try {
      result = await engine.runScan({ args, timeoutMs });
    } catch {
      result = undefined;
    }

    store.update(id, { stage: "parsing" });
    const sanitize = await createSanitizer(config);
    store.update(id, finalRunPatch(result, args, timeoutMs, sanitize, now()));
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
    }
  };
}

function finalRunPatch(
  result: ScanProcessResult | undefined,
  args: RunScanArgs,
  timeoutMs: number,
  sanitize: (line: string) => string,
  finishedAt: Date
): Partial<ScanRunDto> {
  const parsed = parseScanOutput(result?.stdout ?? "");
  const warnings = parsed.warnings
    .map(sanitize)
    .filter((line) => line.length > 0)
    .slice(0, SCAN_WARNINGS_LIMIT);
  const failure = failureFor(result, timeoutMs, sanitize);

  return {
    status: failure ? "failed" : "succeeded",
    stage: failure ? "failed" : "completed",
    active: false,
    finishedAt: finishedAt.toISOString(),
    exitCode: result?.exitCode ?? null,
    summary: {
      offersFound: parsed.offersFound,
      offersProjected: failure || args.dryRun ? 0 : parsed.offersAdded,
      warnings
    },
    failure
  };
}

function failureFor(
  result: ScanProcessResult | undefined,
  timeoutMs: number,
  sanitize: (line: string) => string
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

  if (result.exitCode !== 0) {
    const lastError = lastNonEmptyLine(result.stderr);
    const detail = lastError ? sanitize(lastError) : "";
    const exit = result.exitCode === null ? `was stopped by ${result.signal ?? "a signal"}` : `exited with code ${result.exitCode}`;
    return {
      code: "COMMAND_FAILED",
      message: `Career Ops scan ${exit}.${detail ? ` Last error: ${detail}` : ""}`
    };
  }

  return null;
}

async function createSanitizer(config: RuntimeConfig): Promise<(line: string) => string> {
  const workspacePaths = [config.workspace, path.resolve(config.workspace)];
  const workspaceRealPath = await realpath(config.workspace).catch(() => undefined);
  if (workspaceRealPath) {
    workspacePaths.push(workspaceRealPath);
  }
  const secrets = config.pairingToken ? [config.pairingToken] : [];

  return (line) => sanitizeScanOutputLine(line, { workspacePaths, secrets });
}

function lastNonEmptyLine(text: string): string | undefined {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .at(-1);
}

function newScanRunId(date: Date): string {
  const stamp = date.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `scan_${stamp}_${randomBytes(3).toString("hex")}`;
}

function scanRunNotFound(): ApiError {
  return new ApiError("NOT_FOUND", "Scan run was not found.");
}
