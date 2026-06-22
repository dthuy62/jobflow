import { realpath } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "../errors/api-error.js";
import { isInsidePath, resolveWorkspaceRoot } from "../workspace/workspace-paths.js";

export async function resolveWorkspaceRelativePath(
  workspacePath: string,
  logicalPath: string
): Promise<string> {
  assertSafeLogicalPath(logicalPath);

  const realWorkspaceRoot = await resolveWorkspaceRoot(workspacePath).catch(() => {
    throwPathOutsideWorkspace();
  });
  const candidatePath = path.resolve(realWorkspaceRoot, logicalPath);
  const realCandidatePath = await realpath(candidatePath).catch(() => {
    throwPathOutsideWorkspace();
  });

  if (!isInsidePath(realWorkspaceRoot, realCandidatePath)) {
    throwPathOutsideWorkspace();
  }

  return realCandidatePath;
}

function assertSafeLogicalPath(logicalPath: string): void {
  if (
    logicalPath.trim() === "" ||
    logicalPath === "." ||
    path.isAbsolute(logicalPath) ||
    path.win32.isAbsolute(logicalPath) ||
    path.posix.isAbsolute(logicalPath) ||
    logicalPath.split(/[\\/]/).some((segment) => segment === "" || segment === "..")
  ) {
    throwPathOutsideWorkspace();
  }
}

function throwPathOutsideWorkspace(): never {
  throw new ApiError(
    "PATH_OUTSIDE_WORKSPACE",
    "Requested path is outside the configured Career Ops Workspace."
  );
}
