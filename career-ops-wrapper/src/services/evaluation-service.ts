import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { RuntimeConfig } from "../config/runtime-config.js";
import {
  EVALUATION_WARNINGS_LIMIT,
  type EvaluationDto,
  type OfferDto,
  type StartEvaluationRequestDto
} from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import { CLAUDE_EVALUATION_ARGV, buildChildEnv } from "../evaluation/claude-command.js";
import {
  CANCELLED_FAILURE,
  WRITE_FAILED_FAILURE,
  describeEvaluationFailure,
  describePostingFailure,
  type EvaluationFailure
} from "../evaluation/evaluation-diagnostics.js";
import { parseCliOutput } from "../evaluation/evaluation-output.js";
import { buildEvaluationPrompt, readEvaluationInputs } from "../evaluation/evaluation-prompt.js";
import { writeEvaluation } from "../evaluation/evaluation-writer.js";
import { fetchPostingText, type FetchPostingOptions, type PostingResult } from "../evaluation/posting-fetcher.js";
import { parseScoreToPercent } from "../parsers/index.js";
import { runBoundedProcess } from "../process/bounded-process.js";
import { RunStore } from "../runs/index.js";
import { listReportFiles } from "../workspace/report-file-adapter.js";
import { createEvaluationReadiness, type EvaluationReadiness } from "./evaluation-readiness.js";
import { createOfferService, type OfferService } from "./offer-service.js";

export interface EvaluationService {
  start(request: StartEvaluationRequestDto): Promise<EvaluationDto>;
  get(id: string): EvaluationDto;
  latest(): EvaluationDto;
  /** Stops a run before it starts writing; later, and for finished runs, returns it unchanged. */
  cancel(id: string): EvaluationDto;
  /** Resolves once no evaluation is executing. */
  waitForIdle(): Promise<void>;
  /** Stops a running CLI and waits for its run to settle. */
  shutdown(): Promise<void>;
}

export interface EvaluationServiceOptions {
  readonly readiness?: EvaluationReadiness;
  readonly offers?: OfferService;
  readonly fetchPosting?: (url: string, options: FetchPostingOptions) => Promise<PostingResult>;
  readonly now?: () => Date;
}

/** CLI stdout is kept whole (a cut JSON cannot be read) up to this size. */
export const EVALUATION_STDOUT_MAX_CHARS = 1024 * 1024;

const POSTING_TRUNCATED_WARNING = "The job posting was cut to the size limit.";
const INPUTS_UNREADABLE: EvaluationFailure = {
  code: "COMMAND_FAILED",
  message: "AI evaluation could not read the workspace files it needs."
};
const SHUTDOWN_FAILURE: EvaluationFailure = {
  code: "COMMAND_FAILED",
  message: "AI evaluation was stopped because the wrapper shut down."
};

interface RunControl {
  readonly abort: AbortController;
  cancelRequested: boolean;
}

export function createEvaluationService(
  config: RuntimeConfig,
  options: EvaluationServiceOptions = {}
): EvaluationService {
  const store = new RunStore<EvaluationDto>();
  const readiness = options.readiness ?? createEvaluationReadiness(config);
  const offers = options.offers ?? createOfferService(config);
  const fetchPosting = options.fetchPosting ?? fetchPostingText;
  const now = options.now ?? (() => new Date());
  const controls = new Map<string, RunControl>();
  let shuttingDown = false;
  let execution: Promise<void> = Promise.resolve();

  const finish = (id: string, patch: Partial<EvaluationDto>): void => {
    const failed = patch.failure !== undefined && patch.failure !== null;
    const cancelled = patch.failure?.code === "CANCELLED";
    store.update(id, {
      status: cancelled ? "cancelled" : failed ? "failed" : "succeeded",
      stage: cancelled ? "cancelled" : failed ? "failed" : "completed",
      active: false,
      finishedAt: now().toISOString(),
      ...patch
    });
    controls.delete(id);
  };

  const stopFailure = (control: RunControl): EvaluationFailure | undefined =>
    shuttingDown ? SHUTDOWN_FAILURE : control.cancelRequested ? CANCELLED_FAILURE : undefined;

  async function execute(id: string, offer: OfferDto, cliPath: string, control: RunControl): Promise<void> {
    const warnings: string[] = [];
    const posting = await fetchPosting(offer.url ?? "", { signal: control.abort.signal });
    const stoppedEarly = stopFailure(control);
    if (stoppedEarly) {
      finish(id, { failure: stoppedEarly });
      return;
    }
    if (!posting.ok) {
      finish(id, { failure: describePostingFailure(posting.reason) });
      return;
    }
    if (posting.truncated) {
      warnings.push(POSTING_TRUNCATED_WARNING);
    }

    const read = await readEvaluationInputs(config.workspace);
    if (!read.inputs) {
      finish(id, { failure: INPUTS_UNREADABLE });
      return;
    }
    warnings.push(...read.warnings);

    store.update(id, { stage: "evaluating" });
    const timeoutMs = config.evaluation?.timeoutMs ?? 0;
    const cwd = await mkdtemp(path.join(tmpdir(), "jobflow-eval-"));
    let result;
    try {
      result = await runBoundedProcess({
        command: cliPath,
        args: CLAUDE_EVALUATION_ARGV,
        cwd,
        env: buildChildEnv(process.env),
        timeoutMs,
        signal: control.abort.signal,
        stdin: buildEvaluationPrompt(
          read.inputs,
          { company: offer.company, title: offer.title, location: offer.location ?? null, url: offer.url ?? "" },
          posting.text
        ),
        stdoutMode: { kind: "whole", maxChars: EVALUATION_STDOUT_MAX_CHARS }
      });
    } finally {
      await rm(cwd, { recursive: true, force: true }).catch(() => undefined);
    }

    const stopped = stopFailure(control);
    if (stopped) {
      finish(id, { failure: stopped });
      return;
    }
    const parsed = parseCliOutput(result.stdout);
    const failure = describeEvaluationFailure(result, parsed, timeoutMs);
    if (failure || !parsed.ok) {
      finish(id, { failure: failure ?? INPUTS_UNREADABLE });
      return;
    }

    // From here on cancel is ignored: stopping halfway would leave a sentinel
    // or half a tracker merge behind.
    store.update(id, { stage: "writing" });
    try {
      const written = await writeEvaluation({
        workspace: config.workspace,
        offer,
        output: parsed.output,
        provider: "claude",
        date: now()
      });
      warnings.push(...written.warnings);
      const report = (await listReportFiles(config.workspace)).find((file) => file.fileName === written.reportFileName);
      if (!report) {
        finish(id, { failure: WRITE_FAILED_FAILURE });
        return;
      }
      finish(id, {
        failure: null,
        result: { reportId: report.id, score: parseScoreToPercent(written.scoreText) ?? 0, artifactIds: [] },
        warnings: warnings.slice(0, EVALUATION_WARNINGS_LIMIT)
      });
    } catch {
      finish(id, { failure: WRITE_FAILED_FAILURE });
    }
  }

  return {
    async start(request: StartEvaluationRequestDto): Promise<EvaluationDto> {
      // Busy check and pending run happen before any await, so two requests
      // at the same moment cannot both start.
      const active = store.active();
      if (active) {
        throw new ApiError("EVALUATION_ALREADY_RUNNING", "An evaluation is already running.", {
          activeEvaluationId: active.id
        });
      }
      const id = newEvaluationId(now());
      store.put({
        id,
        offerId: request.offerId,
        provider: config.evaluation?.provider ?? "claude",
        status: "pending",
        stage: "queued",
        active: true,
        startedAt: null,
        finishedAt: null,
        result: null,
        warnings: [],
        failure: null
      });
      // Registered now, so a cancel during the checks below is not lost.
      const control: RunControl = { abort: new AbortController(), cancelRequested: false };
      controls.set(id, control);

      let offer: OfferDto;
      let cliPath: string;
      try {
        const ready = await readiness.get(true);
        if (ready.status !== "ready" || !ready.cliPath) {
          throw new ApiError("WORKSPACE_UNHEALTHY", "AI evaluation is not ready.", {
            reason: "evaluation-not-ready",
            missingRequirements: ready.missingRequirements
          });
        }
        cliPath = ready.cliPath;
        offer = await offers.getOffer(request.offerId);
        if (!offer.url) {
          throw new ApiError("VALIDATION_ERROR", "This offer has no URL to evaluate.", { reason: "offer-has-no-url" });
        }
        if (offer.evaluationStatus === "evaluated") {
          throw new ApiError("VALIDATION_ERROR", "This offer is already evaluated.", {
            reason: "offer-already-evaluated"
          });
        }
      } catch (error) {
        controls.delete(id);
        store.delete(id);
        throw error;
      }

      if (control.cancelRequested) {
        finish(id, { failure: CANCELLED_FAILURE });
        return store.get(id) as EvaluationDto;
      }
      const running = store.update(id, {
        status: "running",
        stage: "fetching-posting",
        startedAt: now().toISOString()
      }) as EvaluationDto;
      execution = execute(id, offer, cliPath, control).catch(() => {
        finish(id, { failure: stopFailure(control) ?? INPUTS_UNREADABLE });
      });
      return running;
    },

    get(id: string): EvaluationDto {
      const run = store.get(id);
      if (!run) {
        throw evaluationNotFound();
      }
      return run;
    },

    latest(): EvaluationDto {
      const run = store.latest();
      if (!run) {
        throw evaluationNotFound();
      }
      return run;
    },

    cancel(id: string): EvaluationDto {
      const run = store.get(id);
      if (!run) {
        throw evaluationNotFound();
      }
      const control = controls.get(id);
      if (run.active && control && run.stage !== "writing") {
        control.cancelRequested = true;
        control.abort.abort();
      }
      return run;
    },

    async waitForIdle(): Promise<void> {
      await execution;
    },

    async shutdown(): Promise<void> {
      shuttingDown = true;
      for (const control of controls.values()) {
        control.abort.abort();
      }
      await execution;
    }
  };
}

function newEvaluationId(date: Date): string {
  const stamp = date.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `eval_${stamp}_${randomBytes(3).toString("hex")}`;
}

function evaluationNotFound(): ApiError {
  return new ApiError("NOT_FOUND", "Evaluation was not found.");
}
