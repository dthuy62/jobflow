import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "../errors/api-error.js";
import { isInsidePath, resolveWorkspaceRoot } from "./workspace-paths.js";

export interface WorkspaceTextFile {
  readonly content: string;
  readonly mtime: Date;
}

export interface WorkspaceFileEntry {
  readonly name: string;
  /** Absolute real path; wrapper-internal only, never returned to clients. */
  readonly realPath: string;
  readonly sizeBytes: number;
  readonly mtime: Date;
}

/**
 * Reads a fixed workspace file as UTF-8. Returns `undefined` when it does not
 * exist; rejects files whose real path leaves the workspace or exceeds `maxBytes`.
 */
export async function readOptionalWorkspaceText(
  workspacePath: string,
  relativePath: string,
  maxBytes: number
): Promise<WorkspaceTextFile | undefined> {
  const workspaceRoot = await resolveRoot(workspacePath);
  let targetRealPath: string;

  try {
    targetRealPath = await realpath(path.join(workspaceRoot, relativePath));
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw new ApiError("WORKSPACE_UNHEALTHY", "Career Ops workspace file is not readable.");
  }

  if (!isInsidePath(workspaceRoot, targetRealPath)) {
    throwPathOutsideWorkspace();
  }

  const fileStat = await stat(targetRealPath);
  if (!fileStat.isFile()) {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Career Ops workspace file is not readable.");
  }

  if (fileStat.size > maxBytes) {
    throw new ApiError("PAYLOAD_TOO_LARGE", "Career Ops workspace file is too large to read.");
  }

  return {
    content: await readFile(targetRealPath, "utf8"),
    mtime: fileStat.mtime
  };
}

/**
 * Lists regular files directly inside a workspace directory. Symbolic links,
 * subdirectories, and a directory whose real path leaves the workspace are skipped.
 */
export async function listWorkspaceFiles(
  workspacePath: string,
  relativeDir: string,
  include: (name: string) => boolean
): Promise<WorkspaceFileEntry[]> {
  const workspaceRoot = await resolveRoot(workspacePath);
  let dirRealPath: string;

  try {
    dirRealPath = await realpath(path.join(workspaceRoot, relativeDir));
  } catch {
    return [];
  }

  if (!isInsidePath(workspaceRoot, dirRealPath)) {
    return [];
  }

  const entries = await readdir(dirRealPath, { withFileTypes: true }).catch(() => []);
  const files: WorkspaceFileEntry[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !include(entry.name)) {
      continue;
    }

    const filePath = path.join(dirRealPath, entry.name);
    const fileStat = await stat(filePath).catch(() => undefined);
    if (!fileStat?.isFile()) {
      continue;
    }

    files.push({
      name: entry.name,
      realPath: filePath,
      sizeBytes: fileStat.size,
      mtime: fileStat.mtime
    });
  }

  return files.sort((left, right) => left.name.localeCompare(right.name));
}

async function resolveRoot(workspacePath: string): Promise<string> {
  return resolveWorkspaceRoot(workspacePath).catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Career Ops workspace is not ready.");
  });
}

function throwPathOutsideWorkspace(): never {
  throw new ApiError(
    "PATH_OUTSIDE_WORKSPACE",
    "Requested path is outside the configured Career Ops Workspace."
  );
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}
