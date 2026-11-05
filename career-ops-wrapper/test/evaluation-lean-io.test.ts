import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// Module-wide mocks: link() is unsupported (as on exFAT, some SMB/NFS or
// cloud-sync volumes), and workspace text reads are recorded.
const reads: string[] = [];
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof import("node:fs/promises")>();
  return {
    ...actual,
    link: async () => {
      throw Object.assign(new Error("operation not permitted"), { code: "EPERM" });
    }
  };
});
vi.mock("../src/workspace/workspace-reader.js", async (original) => {
  const actual = await original<typeof import("../src/workspace/workspace-reader.js")>();
  return {
    ...actual,
    readOptionalWorkspaceText: async (workspace: string, relativePath: string, maxBytes: number) => {
      reads.push(relativePath);
      return actual.readOptionalWorkspaceText(workspace, relativePath, maxBytes);
    }
  };
});

const { writeWorkspaceFileSafely } = await import("../src/workspace/safe-file-adapter.js");
const { createEvaluationReadiness } = await import("../src/services/evaluation-readiness.js");
const { createFakeClaude } = await import("./support/fake-claude.js");
const { copyProjectionFixture, removeWorkspaces } = await import("./support/fixture-workspace.js");

const workspaces: string[] = [];
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  await removeWorkspaces(workspaces);
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  reads.length = 0;
});

describe("create-only writes without hard links", () => {
  it("still creates the file once and never replaces it", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "no-link-"));
    cleanups.push(() => rm(dir, { recursive: true, force: true }));

    await writeWorkspaceFileSafely({ workspacePath: dir, relativePath: "report.md", content: "one", createOnly: true });
    await expect(
      writeWorkspaceFileSafely({ workspacePath: dir, relativePath: "report.md", content: "two", createOnly: true })
    ).rejects.toThrow();

    expect(await readFile(path.join(dir, "report.md"), "utf8")).toBe("one");
  });
});

describe("evaluation readiness", () => {
  it("checks the CV and rubric files without reading their content", async () => {
    const workspace = await copyProjectionFixture();
    workspaces.push(workspace);
    const fake = await createFakeClaude({ auth: { loggedIn: true } });
    cleanups.push(() => fake.remove());

    const readiness = await createEvaluationReadiness({
      host: "0.0.0.0",
      port: 3000,
      workspace,
      evaluation: { provider: "claude", timeoutMs: 60_000, cliPath: fake.cliPath }
    }).get();

    expect(readiness.status).toBe("ready");
    expect(reads).toEqual([]);
  });
});
