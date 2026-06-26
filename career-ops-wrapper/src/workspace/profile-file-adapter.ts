import { createHash } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { access, lstat, mkdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { dump as dumpYaml, load as loadYaml } from "js-yaml";
import { ApiError } from "../errors/api-error.js";
import { writeWorkspaceFileSafely } from "./safe-file-adapter.js";
import { isInsidePath, resolveWorkspaceRoot } from "./workspace-paths.js";

const PROFILE_RELATIVE_PATHS = [
  "config/profile.yml",
  "config/profile.yaml",
  "profile.yml",
  "profile.yaml"
] as const;

export interface ProfileFileRead {
  readonly parsedProfile: unknown;
  readonly rawYaml: string;
  readonly relativePath: string;
  readonly sourceRevision: string;
  readonly updatedAt: string;
}

export interface ProfileFileAdapter {
  readProfileConfig(): Promise<ProfileFileRead>;
  writeProfileConfig(profile: unknown): Promise<ProfileFileRead>;
}

export function createProfileFileAdapter(workspacePath: string): ProfileFileAdapter {
  return {
    async readProfileConfig(): Promise<ProfileFileRead> {
      return readProfileConfigFromWorkspace(workspacePath);
    },

    async writeProfileConfig(profile: unknown): Promise<ProfileFileRead> {
      return writeProfileConfigToWorkspace(workspacePath, profile);
    }
  };
}

async function readProfileConfigFromWorkspace(workspacePath: string): Promise<ProfileFileRead> {
  const workspaceRoot = await resolveWorkspaceRoot(workspacePath).catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Career Ops workspace is not ready.");
  });

  for (const relativePath of PROFILE_RELATIVE_PATHS) {
    const targetPath = path.join(workspaceRoot, relativePath);
    const targetStat = await readCandidateStat(targetPath);

    if (!targetStat) {
      continue;
    }

    return readProfileCandidate(workspaceRoot, targetPath, relativePath, targetStat);
  }

  throw new ApiError("NOT_FOUND", "Profile config file is missing.");
}

async function writeProfileConfigToWorkspace(
  workspacePath: string,
  profile: unknown
): Promise<ProfileFileRead> {
  const workspaceRoot = await resolveWorkspaceRoot(workspacePath).catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Career Ops workspace is not ready.");
  });
  const relativePath = await findProfileWriteRelativePath(workspaceRoot);

  await mkdir(path.dirname(path.join(workspaceRoot, relativePath)), { recursive: true }).catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Profile config file is not writable.");
  });

  const yaml = dumpYaml(profile, {
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
    throw new ApiError("WORKSPACE_UNHEALTHY", "Profile config file is not readable.");
  });

  return readProfileCandidate(workspaceRoot, targetPath, relativePath, targetStat);
}

async function findProfileWriteRelativePath(workspaceRoot: string): Promise<string> {
  for (const relativePath of PROFILE_RELATIVE_PATHS) {
    const targetPath = path.join(workspaceRoot, relativePath);
    const targetStat = await readCandidateStat(targetPath);

    if (!targetStat) {
      continue;
    }

    await readProfileCandidate(workspaceRoot, targetPath, relativePath, targetStat);
    return relativePath;
  }

  return "config/profile.yml";
}

async function readCandidateStat(targetPath: string): Promise<Stats | undefined> {
  try {
    return await lstat(targetPath);
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw new ApiError("WORKSPACE_UNHEALTHY", "Profile config file is not readable.");
    }
    return undefined;
  }
}

async function readProfileCandidate(
  workspaceRoot: string,
  targetPath: string,
  relativePath: string,
  targetStat: Stats
): Promise<ProfileFileRead> {
  if (targetStat.isSymbolicLink()) {
    throw new ApiError(
      "PATH_OUTSIDE_WORKSPACE",
      "Profile config file must stay inside the configured Career Ops Workspace."
    );
  }

  const targetRealPath = await realpath(targetPath).catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Profile config file is not readable.");
  });

  if (!isInsidePath(workspaceRoot, targetRealPath)) {
    throw new ApiError(
      "PATH_OUTSIDE_WORKSPACE",
      "Profile config file must stay inside the configured Career Ops Workspace."
    );
  }

  const fileStat = await stat(targetRealPath).catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Profile config file is not readable.");
  });
  if (!fileStat.isFile()) {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Profile config file is not readable.");
  }

  await access(targetRealPath, constants.R_OK).catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Profile config file is not readable.");
  });

  const rawYaml = await readFile(targetRealPath, "utf8").catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Profile config file is not readable.");
  });

  return {
    parsedProfile: parseProfileYaml(rawYaml),
    rawYaml,
    relativePath,
    sourceRevision: `profile_sha256_${createHash("sha256").update(rawYaml).digest("hex").slice(0, 8)}`,
    updatedAt: fileStat.mtime.toISOString()
  };
}

function parseProfileYaml(rawYaml: string): unknown {
  try {
    return loadYaml(rawYaml);
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Profile config YAML is invalid.");
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
