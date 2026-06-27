import { createHash } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { access, lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { dump as dumpYaml, load as loadYaml } from "js-yaml";
import { ApiError } from "../errors/api-error.js";
import { writeWorkspaceFileSafely } from "./safe-file-adapter.js";
import { isInsidePath, resolveWorkspaceRoot } from "./workspace-paths.js";

const PORTAL_RELATIVE_PATHS = ["portals.yml", "portals.yaml"] as const;

export interface PortalFileRead {
  readonly parsedPortal: unknown;
  readonly rawYaml: string;
  readonly relativePath: string;
  readonly sourceRevision: string;
  readonly updatedAt: string;
}

export interface PortalFileAdapter {
  readPortalConfig(): Promise<PortalFileRead>;
  writePortalConfig(portal: unknown): Promise<PortalFileRead>;
}

export function createPortalFileAdapter(workspacePath: string): PortalFileAdapter {
  return {
    async readPortalConfig(): Promise<PortalFileRead> {
      return readPortalConfigFromWorkspace(workspacePath);
    },

    async writePortalConfig(portal: unknown): Promise<PortalFileRead> {
      return writePortalConfigToWorkspace(workspacePath, portal);
    }
  };
}

async function readPortalConfigFromWorkspace(workspacePath: string): Promise<PortalFileRead> {
  const workspaceRoot = await resolveWorkspaceRoot(workspacePath).catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Career Ops workspace is not ready.");
  });

  for (const relativePath of PORTAL_RELATIVE_PATHS) {
    const targetPath = path.join(workspaceRoot, relativePath);
    const targetStat = await readCandidateStat(targetPath);

    if (!targetStat) {
      continue;
    }

    return readPortalCandidate(workspaceRoot, targetPath, relativePath, targetStat);
  }

  throw new ApiError("NOT_FOUND", "Portal config file is missing.");
}

async function writePortalConfigToWorkspace(
  workspacePath: string,
  portal: unknown
): Promise<PortalFileRead> {
  const workspaceRoot = await resolveWorkspaceRoot(workspacePath).catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Career Ops workspace is not ready.");
  });
  const relativePath = await findPortalWriteRelativePath(workspaceRoot);
  const yaml = dumpYaml(portal, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  });

  await writeWorkspaceFileSafely({
    workspacePath,
    relativePath,
    content: yaml
  });

  const targetPath = path.join(workspaceRoot, relativePath);
  const targetStat = await lstat(targetPath).catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Portal config file is not readable.");
  });

  return readPortalCandidate(workspaceRoot, targetPath, relativePath, targetStat);
}

async function findPortalWriteRelativePath(workspaceRoot: string): Promise<string> {
  for (const relativePath of PORTAL_RELATIVE_PATHS) {
    const targetPath = path.join(workspaceRoot, relativePath);
    const targetStat = await readCandidateStat(targetPath);

    if (!targetStat) {
      continue;
    }

    await readPortalCandidate(workspaceRoot, targetPath, relativePath, targetStat);
    return relativePath;
  }

  return "portals.yml";
}

async function readCandidateStat(targetPath: string): Promise<Stats | undefined> {
  try {
    return await lstat(targetPath);
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw new ApiError("WORKSPACE_UNHEALTHY", "Portal config file is not readable.");
    }
    return undefined;
  }
}

async function readPortalCandidate(
  workspaceRoot: string,
  targetPath: string,
  relativePath: string,
  targetStat: Stats
): Promise<PortalFileRead> {
  if (targetStat.isSymbolicLink()) {
    throw new ApiError(
      "PATH_OUTSIDE_WORKSPACE",
      "Portal config file must stay inside the configured Career Ops Workspace."
    );
  }

  const targetRealPath = await realpath(targetPath).catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Portal config file is not readable.");
  });

  if (!isInsidePath(workspaceRoot, targetRealPath)) {
    throw new ApiError(
      "PATH_OUTSIDE_WORKSPACE",
      "Portal config file must stay inside the configured Career Ops Workspace."
    );
  }

  const fileStat = await stat(targetRealPath).catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Portal config file is not readable.");
  });
  if (!fileStat.isFile()) {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Portal config file is not readable.");
  }

  await access(targetRealPath, constants.R_OK).catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Portal config file is not readable.");
  });

  const rawYaml = await readFile(targetRealPath, "utf8").catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Portal config file is not readable.");
  });

  return {
    parsedPortal: parsePortalYaml(rawYaml),
    rawYaml,
    relativePath,
    sourceRevision: `portals_sha256_${createHash("sha256").update(rawYaml).digest("hex").slice(0, 8)}`,
    updatedAt: fileStat.mtime.toISOString()
  };
}

function parsePortalYaml(rawYaml: string): unknown {
  try {
    const parsed = loadYaml(rawYaml);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Portal root must be an object.");
    }
    return parsed;
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Portal config YAML is invalid.");
  }
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}
