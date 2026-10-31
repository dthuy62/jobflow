import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectionFixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/workspaces/career-ops-projection"
);

/** Copies the synthetic projection fixture so tests can mutate it. */
export async function copyProjectionFixture(): Promise<string> {
  const workspace = await mkdtemp(path.join(tmpdir(), "career-ops-projection-"));
  await cp(projectionFixturePath, workspace, { recursive: true });
  return workspace;
}

export async function removeWorkspaces(workspaces: string[]): Promise<void> {
  await Promise.all(workspaces.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
}
