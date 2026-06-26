import { randomUUID } from "node:crypto";
import { copyFile, lstat, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "../errors/api-error.js";
import { isInsidePath, resolveWorkspaceRoot } from "./workspace-paths.js";

export interface WriteWorkspaceFileSafelyOptions {
  readonly workspacePath: string;
  readonly relativePath: string;
  readonly content: string;
}

export interface WriteWorkspaceFileSafelyResult {
  readonly targetPath: string;
  readonly backupPath?: string;
}

const writeQueues = new Map<string, Promise<void>>();

export async function writeWorkspaceFileSafely(
  options: WriteWorkspaceFileSafelyOptions
): Promise<WriteWorkspaceFileSafelyResult> {
  const workspaceRoot = await resolveWorkspaceRoot(options.workspacePath).catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Career Ops workspace is not ready.");
  });
  const targetPath = path.resolve(workspaceRoot, options.relativePath);

  if (!isInsidePath(workspaceRoot, targetPath)) {
    throw new ApiError(
      "PATH_OUTSIDE_WORKSPACE",
      "Requested path is outside the configured Career Ops Workspace."
    );
  }

  return withTargetWriteLock(targetPath, () =>
    writeWorkspaceFileSafelyUnlocked(workspaceRoot, targetPath, options.content)
  );
}

async function writeWorkspaceFileSafelyUnlocked(
  workspaceRoot: string,
  targetPath: string,
  content: string
): Promise<WriteWorkspaceFileSafelyResult> {
  const tempPath = path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.${randomUUID()}.tmp`);
  const backupPath = `${targetPath}.bak`;
  let hasBackup = false;

  try {
    await assertSafeParentDirectory(workspaceRoot, path.dirname(targetPath));
    await assertSafeExistingPath(workspaceRoot, targetPath);
    await assertSafeExistingPath(workspaceRoot, backupPath);

    try {
      await copyFile(targetPath, backupPath);
      hasBackup = true;
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }

    await writeFile(tempPath, content, "utf8");
    await rename(tempPath, targetPath);

    if ((await readFile(targetPath, "utf8")) !== content) {
      throw new ApiError("UNEXPECTED_ERROR", "Saved workspace file did not match the requested content.");
    }

    return {
      targetPath: await realpath(targetPath),
      ...(hasBackup ? { backupPath: await realpath(backupPath) } : {})
    };
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError("UNEXPECTED_ERROR", "Failed to save workspace file.");
  }
}

async function withTargetWriteLock<T>(targetPath: string, operation: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(targetPath) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => current);
  writeQueues.set(targetPath, queued);

  await previous.catch(() => undefined);

  try {
    return await operation();
  } finally {
    release();
    if (writeQueues.get(targetPath) === queued) {
      writeQueues.delete(targetPath);
    }
  }
}

async function assertSafeParentDirectory(workspaceRoot: string, parentPath: string): Promise<void> {
  const parentStat = await lstat(parentPath);

  if (parentStat.isSymbolicLink()) {
    throw new ApiError("PATH_OUTSIDE_WORKSPACE", "Workspace file parent must not be a symbolic link.");
  }

  if (!parentStat.isDirectory()) {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Workspace file parent is not writable.");
  }

  if (!isInsidePath(workspaceRoot, await realpath(parentPath))) {
    throw new ApiError(
      "PATH_OUTSIDE_WORKSPACE",
      "Requested path is outside the configured Career Ops Workspace."
    );
  }
}

async function assertSafeExistingPath(workspaceRoot: string, filePath: string): Promise<void> {
  let fileStat;
  try {
    fileStat = await lstat(filePath);
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }

    throw error;
  }

  if (fileStat.isSymbolicLink()) {
    throw new ApiError("PATH_OUTSIDE_WORKSPACE", "Workspace file must not be a symbolic link.");
  }

  if (!isInsidePath(workspaceRoot, await realpath(filePath))) {
    throw new ApiError(
      "PATH_OUTSIDE_WORKSPACE",
      "Requested path is outside the configured Career Ops Workspace."
    );
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
