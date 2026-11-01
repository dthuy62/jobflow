import type { HealthDto } from "../contracts/index.js";
import type { RuntimeConfig } from "../config/runtime-config.js";
import { getScriptReadiness } from "../career-ops-engine/script-readiness.js";
import { getWorkspaceHealth } from "../workspace/workspace-health.js";
import { createEvaluationReadiness, type EvaluationReadiness } from "./evaluation-readiness.js";

export interface HealthService {
  getHealth(): Promise<HealthDto>;
}

export function createHealthService(
  config: RuntimeConfig,
  evaluationReadiness: EvaluationReadiness = createEvaluationReadiness(config)
): HealthService {
  return {
    async getHealth(): Promise<HealthDto> {
      const workspace = await getWorkspaceHealth(config.workspace);
      const careerOps = await getScriptReadiness(config.workspace);
      const { status: evaluatorStatus, provider, missingRequirements } = await evaluationReadiness.get();
      const isReady = workspace.status === "ready" && careerOps.status === "ready";

      return {
        status: isReady ? "ready" : "notReady",
        apiVersion: "v1",
        workspace,
        careerOps: {
          ...careerOps,
          aiCliRequired: config.evaluation !== undefined,
          evaluator: { status: evaluatorStatus, provider, missingRequirements }
        },
        capabilities: {
          cv: workspace.status === "ready",
          profile: workspace.status === "ready",
          portals: workspace.status === "ready",
          scan: isReady,
          reports: workspace.status === "ready",
          artifacts: workspace.status === "ready",
          cvConversion: false,
          geminiEvaluation: false,
          aiEvaluation: evaluatorStatus === "ready"
        },
        serverTime: new Date().toISOString()
      };
    }
  };
}
