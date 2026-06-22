import { access, realpath, stat } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import type {
  CareerOpsReadinessDto,
  ScriptReadinessCheckDto
} from "../contracts/index.js";

type RequirementName = ScriptReadinessCheckDto["name"];

interface RequiredFile {
  readonly name: RequirementName;
  readonly relativePaths: readonly string[];
}

const REQUIRED_FILES: readonly RequiredFile[] = [
  { name: "doctor-script", relativePaths: ["doctor.mjs"] },
  { name: "scan-script", relativePaths: ["scan.mjs"] },
  { name: "portal-config", relativePaths: ["portals.yml", "portals.yaml"] }
];

export async function getScriptReadiness(workspacePath: string): Promise<CareerOpsReadinessDto> {
  const workspaceRealPath = await getRealPath(workspacePath);
  const checks = await Promise.all(
    REQUIRED_FILES.map(async (requiredFile) =>
      checkRequiredFile(workspacePath, workspaceRealPath, requiredFile)
    )
  );
  const missingRequirements = checks
    .filter((check) => check.status !== "ready")
    .map((check) => check.name);
  const status = missingRequirements.length === 0 ? "ready" : "notReady";

  return {
    status,
    executionMode: "local-script-runner",
    providerApiKeyRequired: false,
    aiCliRequired: false,
    scanner: {
      status,
      commandType: "local-script",
      missingRequirements,
      checks,
      messages:
        status === "ready"
          ? ["Local Career Ops scan script prerequisites are present."]
          : ["Local Career Ops scan script prerequisites are incomplete."]
    }
  };
}

async function checkRequiredFile(
  workspacePath: string,
  workspaceRealPath: string | undefined,
  requiredFile: RequiredFile
): Promise<ScriptReadinessCheckDto> {
  let foundCandidate = false;

  for (const relativePath of requiredFile.relativePaths) {
    const targetPath = path.join(workspacePath, relativePath);
    const status = await checkReadableRegularWorkspaceFile(targetPath, workspaceRealPath);

    if (status === "ready") {
      return { name: requiredFile.name, status: "ready" };
    }

    if (status === "invalid") {
      foundCandidate = true;
    }
  }

  return { name: requiredFile.name, status: foundCandidate ? "invalid" : "missing" };
}

async function checkReadableRegularWorkspaceFile(
  targetPath: string,
  workspaceRealPath: string | undefined
): Promise<ScriptReadinessCheckDto["status"]> {
  let targetRealPath: string;

  try {
    targetRealPath = await realpath(targetPath);
  } catch {
    return "missing";
  }

  if (!workspaceRealPath || !isPathInside(targetRealPath, workspaceRealPath)) {
    return "invalid";
  }

  try {
    const targetStat = await stat(targetRealPath);
    if (!targetStat.isFile()) {
      return "invalid";
    }

    await access(targetRealPath, constants.R_OK);
    return "ready";
  } catch {
    return "invalid";
  }
}

async function getRealPath(targetPath: string): Promise<string | undefined> {
  try {
    return await realpath(targetPath);
  } catch {
    return undefined;
  }
}

function isPathInside(targetPath: string, rootPath: string): boolean {
  const relativePath = path.relative(rootPath, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}
