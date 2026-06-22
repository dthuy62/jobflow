import type { HealthDto } from "../contracts/index.js";
import type { RuntimeConfig } from "../config/runtime-config.js";
import { getScriptReadiness } from "../career-ops-engine/script-readiness.js";
import { getWorkspaceHealth } from "../workspace/workspace-health.js";

export interface HealthService {
  getHealth(): Promise<HealthDto>;
}

export function createHealthService(config: RuntimeConfig): HealthService {
  return {
    async getHealth(): Promise<HealthDto> {
      const workspace = await getWorkspaceHealth(config.workspace);
      const careerOps = await getScriptReadiness(config.workspace);
      const isReady = workspace.status === "ready" && careerOps.status === "ready";

      return {
        status: isReady ? "ready" : "notReady",
        apiVersion: "v1",
        workspace,
        careerOps,
        capabilities: {
          cv: workspace.status === "ready",
          profile: workspace.status === "ready",
          portals: workspace.status === "ready",
          scan: false,
          reports: false,
          artifacts: false,
          cvConversion: false,
          geminiEvaluation: false
        },
        serverTime: new Date().toISOString()
      };
    }
  };
}
