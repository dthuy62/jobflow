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

/**
 * The configured, resolved, and real workspace paths, for redaction. A
 * relative configured value is left out: it would redact a plain word.
 */
export async function listWorkspacePathVariants(workspacePath: string): Promise<string[]> {
  const variants = new Set([path.resolve(workspacePath)]);
  if (path.isAbsolute(workspacePath)) {
    variants.add(workspacePath);
  }
  const realWorkspacePath = await realpath(workspacePath).catch(() => undefined);
  if (realWorkspacePath) {
    variants.add(realWorkspacePath);
  }
  return [...variants];
}
