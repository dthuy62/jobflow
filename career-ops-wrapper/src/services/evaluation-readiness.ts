import { stat } from "node:fs/promises";
import type { RuntimeConfig } from "../config/runtime-config.js";
import type { EvaluatorReadinessDto } from "../contracts/index.js";
import { resolveCliPath } from "../evaluation/claude-command.js";
import { createCliAuthChecker, type CliAuthChecker } from "../evaluation/cli-auth.js";
import { readEvaluationInputs } from "../evaluation/evaluation-prompt.js";
import { resolveWorkspaceRelativePath } from "../security/path-guard.js";

export interface EvaluationReadinessResult extends EvaluatorReadinessDto {
  /** Wrapper-internal; never returned to clients. */
  readonly cliPath?: string;
}

export interface EvaluationReadiness {
  /** `fresh` re-checks the CLI login instead of using the 60-second cache (used by POST). */
  get(fresh?: boolean): Promise<EvaluationReadinessResult>;
}

const REQUIRED_WORKSPACE_FILES = [
  { path: "reserve-report-num.mjs", missing: "scripts.reserve-report-num-missing" },
  { path: "merge-tracker.mjs", missing: "scripts.merge-tracker-missing" },
  { path: "data/applications.md", missing: "tracker.missing" }
] as const;

/** One instance is shared by health and the evaluation service, so they share the auth cache. */
export function createEvaluationReadiness(config: RuntimeConfig): EvaluationReadiness {
  const checkers = new Map<string, CliAuthChecker>();

  return {
    async get(fresh = false): Promise<EvaluationReadinessResult> {
      const evaluation = config.evaluation;
      if (!evaluation) {
        return { status: "disabled", provider: null, missingRequirements: ["evaluation.provider-not-configured"] };
      }

      const missingRequirements: string[] = [];
      const cliPath = await resolveCliPath(evaluation);
      if (!cliPath) {
        missingRequirements.push("evaluation.cli-missing");
      } else {
        let checker = checkers.get(cliPath);
        if (!checker) {
          checker = createCliAuthChecker(cliPath);
          checkers.set(cliPath, checker);
        }
        const auth = await checker.check(fresh);
        if (auth === "logged-out") {
          missingRequirements.push("evaluation.cli-logged-out");
        } else if (auth === "check-failed") {
          missingRequirements.push("evaluation.cli-check-failed");
        }
      }

      missingRequirements.push(...(await readEvaluationInputs(config.workspace)).missingRequirements);
      for (const file of REQUIRED_WORKSPACE_FILES) {
        if (!(await isWorkspaceFile(config.workspace, file.path))) {
          missingRequirements.push(file.missing);
        }
      }

      return {
        status: missingRequirements.length === 0 ? "ready" : "notReady",
        provider: evaluation.provider,
        missingRequirements,
        ...(cliPath ? { cliPath } : {})
      };
    }
  };
}

async function isWorkspaceFile(workspace: string, relativePath: string): Promise<boolean> {
  try {
    return (await stat(await resolveWorkspaceRelativePath(workspace, relativePath))).isFile();
  } catch {
    return false;
  }
}
