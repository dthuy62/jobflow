import { getScriptReadiness } from "../career-ops-engine/script-readiness.js";
import type { RuntimeConfig } from "../config/runtime-config.js";
import {
  ScanReadinessDtoSchema,
  type ErrorCode,
  type ScanReadinessCheckDto,
  type ScanReadinessDto
} from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import { getWorkspaceHealth } from "../workspace/workspace-health.js";
import { createCvService } from "./cv-service.js";
import { createPortalService } from "./portal-service.js";
import { createProfileService } from "./profile-service.js";

export interface ScanReadinessService {
  getScanReadiness(): Promise<ScanReadinessDto>;
}

export function createScanReadinessService(config: RuntimeConfig): ScanReadinessService {
  return {
    async getScanReadiness(): Promise<ScanReadinessDto> {
      const computedAt = new Date().toISOString();
      const [workspace, scanner, cv, profile, portal] = await Promise.all([
        workspaceCheck(config),
        scannerCheck(config),
        inputCheck("cv", () => createCvService(config).getCv()),
        inputCheck("profile", () => createProfileService(config).getProfile()),
        inputCheck("portal", () => createPortalService(config).getPortals())
      ]);
      const checks: ScanReadinessCheckDto[] = [
        { name: "wrapper", status: "ready", message: "Wrapper backend is available." },
        workspace,
        scanner,
        cv,
        profile,
        portal
      ];
      const allReady = checks.every((check) => check.status === "ready");
      const missingRequirements = checks.flatMap((check) =>
        check.status === "notReady" && check.requirement ? [check.requirement] : []
      );
      const status = allReady ? "ready" : "notReady";

      return ScanReadinessDtoSchema.parse({
        status,
        canStartScan: status === "ready",
        computedAt,
        checks,
        missingRequirements
      });
    }
  };
}

async function workspaceCheck(config: RuntimeConfig): Promise<ScanReadinessCheckDto> {
  const health = await getWorkspaceHealth(config.workspace, { checkWritable: false });
  if (health.status === "ready") {
    return {
      name: "workspace",
      status: "ready",
      message: "Career Ops workspace is ready."
    };
  }

  return {
    name: "workspace",
    status: "notReady",
    message: firstMessage(health.messages, "Career Ops workspace is not ready."),
    requirement: "workspace",
    details: {
      code: "WORKSPACE_UNHEALTHY",
      missingRequirements: health.missingRequirements
    }
  };
}

async function scannerCheck(config: RuntimeConfig): Promise<ScanReadinessCheckDto> {
  const readiness = await getScriptReadiness(config.workspace);
  if (readiness.status === "ready") {
    return {
      name: "scanner",
      status: "ready",
      message: "Local scan prerequisites are ready."
    };
  }

  const missingRequirements = readiness.scanner.missingRequirements;
  const firstRequirement = missingRequirements[0] ?? "scanner";
  return {
    name: "scanner",
    status: "notReady",
    message: firstMessage(readiness.scanner.messages, "Local scan prerequisites are not ready."),
    requirement: `scanner.${firstRequirement}`,
    details: { missingRequirements }
  };
}

async function inputCheck(
  name: "cv" | "profile" | "portal",
  read: () => Promise<{ sourceRevision?: string | undefined; updatedAt?: string | null | undefined }>
): Promise<ScanReadinessCheckDto> {
  try {
    const dto = await read();
    return stripUndefined({
      name,
      status: "ready",
      message: `${inputLabel(name)} is ready.`,
      sourceRevision: dto.sourceRevision,
      updatedAt: dto.updatedAt
    });
  } catch (error) {
    return inputFailure(name, error);
  }
}

function inputFailure(name: "cv" | "profile" | "portal", error: unknown): ScanReadinessCheckDto {
  const code: ErrorCode = error instanceof ApiError ? error.code : "UNEXPECTED_ERROR";
  const requirement = requirementFor(name, code);

  return {
    name,
    status: "notReady",
    message: messageFor(name, code),
    requirement,
    details: { code }
  };
}

function requirementFor(name: "cv" | "profile" | "portal", code: ErrorCode): string {
  if (code === "NOT_FOUND") {
    return name === "cv" ? "cv" : `${name}.missing`;
  }
  if (code === "PAYLOAD_TOO_LARGE") {
    return `${name}.payload-too-large`;
  }
  if (code === "VALIDATION_ERROR") {
    return `${name}.validation`;
  }
  if (code === "PATH_OUTSIDE_WORKSPACE") {
    return `${name}.outside-workspace`;
  }
  if (code === "WORKSPACE_UNHEALTHY") {
    return `${name}.unreadable`;
  }
  return `${name}.unavailable`;
}

function messageFor(name: "cv" | "profile" | "portal", code: ErrorCode): string {
  const label = inputLabel(name);
  if (code === "NOT_FOUND") {
    return `${label} is missing.`;
  }
  if (code === "PAYLOAD_TOO_LARGE") {
    return `${label} is too large.`;
  }
  if (code === "VALIDATION_ERROR") {
    return `${label} is invalid.`;
  }
  if (code === "PATH_OUTSIDE_WORKSPACE") {
    return `${label} must stay inside the configured Career Ops Workspace.`;
  }
  if (code === "WORKSPACE_UNHEALTHY") {
    return `${label} is not readable.`;
  }
  return `${label} is unavailable.`;
}

function inputLabel(name: "cv" | "profile" | "portal"): string {
  return {
    cv: "CV Markdown",
    profile: "Profile config",
    portal: "Portal config"
  }[name];
}

function firstMessage(messages: readonly string[], fallback: string): string {
  return messages[0] ?? fallback;
}

function stripUndefined(check: ScanReadinessCheckDto): ScanReadinessCheckDto {
  return Object.fromEntries(
    Object.entries(check).filter(([, value]) => value !== undefined)
  ) as ScanReadinessCheckDto;
}
