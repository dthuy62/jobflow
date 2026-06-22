import { realpath } from "node:fs/promises";
import path from "node:path";

export async function resolveWorkspaceRoot(workspacePath: string): Promise<string> {
  return realpath(path.resolve(workspacePath));
}

export function isInsidePath(rootPath: string, targetPath: string): boolean {
  const relativePath = path.relative(rootPath, targetPath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}
