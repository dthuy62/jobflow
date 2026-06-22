import { randomUUID } from "node:crypto";
import { access, readdir, realpath, stat, writeFile, unlink } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import type { WorkspaceHealthDto } from "../contracts/index.js";

export function getScaffoldWorkspaceHealth(): WorkspaceHealthDto {
  return {
    status: "unknown",
    detected: false,
    careerOpsVersion: null,
    missingRequirements: ["workspace"],
    messages: ["Career Ops workspace readiness is unknown."]
  };
}

export async function getWorkspaceHealth(workspacePath: string): Promise<WorkspaceHealthDto> {
  const missingRequirements: string[] = [];
  let workspaceRealPath: string;

  try {
    const workspaceStat = await stat(workspacePath);

    if (!workspaceStat.isDirectory()) {
      return invalid(["workspace-directory"]);
    }
    workspaceRealPath = await realpath(workspacePath);
  } catch {
    return {
      status: "missing",
      detected: false,
      careerOpsVersion: null,
      missingRequirements: ["workspace"],
      messages: ["Career Ops workspace is missing."]
    };
  }

  try {
    await access(workspacePath, constants.R_OK);
  } catch {
    missingRequirements.push("workspace-readable");
  }

  try {
    await assertWritable(workspacePath);
  } catch {
    missingRequirements.push("workspace-writable");
  }

  const entries = await safeReadDir(workspacePath);

  if (!entries.ok) {
    missingRequirements.push("workspace-listable");
  }

  if (!(await hasCareerOpsStructure(workspacePath, workspaceRealPath))) {
    missingRequirements.push("career-ops-structure");
  }

  if (missingRequirements.length > 0) {
    return invalid(missingRequirements);
  }

  return {
    status: "ready",
    detected: true,
    careerOpsVersion: null,
    missingRequirements: [],
    messages: ["Career Ops workspace is ready."]
  };
}

async function assertWritable(workspacePath: string): Promise<void> {
  const probePath = path.join(workspacePath, `.career-ops-wrapper-write-${randomUUID()}`);

  try {
    await writeFile(probePath, "", { flag: "wx" });
  } finally {
    await unlink(probePath).catch(() => undefined);
  }
}

async function safeReadDir(workspacePath: string): Promise<{ ok: true } | { ok: false }> {
  try {
    await readdir(workspacePath);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

function invalid(missingRequirements: string[]): WorkspaceHealthDto {
  return {
    status: "invalid",
    detected: true,
    careerOpsVersion: null,
    missingRequirements,
    messages: ["Career Ops workspace structure is invalid."]
  };
}

async function hasCareerOpsStructure(
  workspacePath: string,
  workspaceRealPath: string
): Promise<boolean> {
  const hasCv = await hasReadableRegularWorkspaceFile(
    workspacePath,
    workspaceRealPath,
    ["cv.md"]
  );
  const hasProfile = await hasReadableRegularWorkspaceFile(workspacePath, workspaceRealPath, [
    "profile.yml",
    "profile.yaml",
    path.join("config", "profile.yml"),
    path.join("config", "profile.yaml")
  ]);
  const hasPortals = await hasReadableRegularWorkspaceFile(workspacePath, workspaceRealPath, [
    "portals.yml",
    "portals.yaml"
  ]);

  return hasCv && hasProfile && hasPortals;
}

async function hasReadableRegularWorkspaceFile(
  workspacePath: string,
  workspaceRealPath: string,
  relativePaths: readonly string[]
): Promise<boolean> {
  for (const relativePath of relativePaths) {
    if (await isReadableRegularWorkspaceFile(path.join(workspacePath, relativePath), workspaceRealPath)) {
      return true;
    }
  }

  return false;
}

async function isReadableRegularWorkspaceFile(
  targetPath: string,
  workspaceRealPath: string
): Promise<boolean> {
  try {
    const targetRealPath = await realpath(targetPath);

    if (!isPathInside(targetRealPath, workspaceRealPath)) {
      return false;
    }

    const targetStat = await stat(targetRealPath);
    if (!targetStat.isFile()) {
      return false;
    }

    await access(targetRealPath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function isPathInside(targetPath: string, rootPath: string): boolean {
  const relativePath = path.relative(rootPath, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}
