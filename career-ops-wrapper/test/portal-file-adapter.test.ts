import { chmod, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "../src/errors/api-error.js";
import { createPortalFileAdapter } from "../src/workspace/portal-file-adapter.js";

const tempDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const workspace = await mkdir(path.join(tmpdir(), `career-ops-portal-adapter-${Date.now()}`), {
    recursive: true
  });
  tempDirs.push(workspace);
  return workspace;
}

async function writePortal(workspace: string, relativePath: string, yaml: string): Promise<void> {
  const targetPath = path.join(workspace, relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, yaml);
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("portal file adapter", () => {
  it("reads portals.yml before portals.yaml", async () => {
    const workspace = await createTempWorkspace();
    await writePortal(workspace, "portals.yaml", "title_filter:\n  positive: [Yaml]\n");
    await writePortal(workspace, "portals.yml", "title_filter:\n  positive: [Yml]\n");

    const result = await createPortalFileAdapter(workspace).readPortalConfig();

    expect(result.relativePath).toBe("portals.yml");
    expect(result.parsedPortal).toMatchObject({
      title_filter: {
        positive: ["Yml"]
      }
    });
    expect(result.sourceRevision).toMatch(/^portals_sha256_[a-f0-9]{8}$/);
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("falls back to portals.yaml and keeps unknown YAML untouched", async () => {
    const workspace = await createTempWorkspace();
    const yaml = "title_filter:\n  positive: [Mobile]\nunknown_top_level: keep-me\n";
    await writePortal(workspace, "portals.yaml", yaml);

    const result = await createPortalFileAdapter(workspace).readPortalConfig();

    expect(result.relativePath).toBe("portals.yaml");
    expect(result.parsedPortal).toMatchObject({ unknown_top_level: "keep-me" });
    await expect(readFile(path.join(workspace, "portals.yaml"), "utf8")).resolves.toBe(yaml);
  });

  it.each([
    ["missing portal file", async (workspace: string) => workspace, "NOT_FOUND"],
    [
      "malformed YAML",
      async (workspace: string) => writePortal(workspace, "portals.yml", "title_filter: ["),
      "VALIDATION_ERROR"
    ],
    [
      "invalid root structure",
      async (workspace: string) => writePortal(workspace, "portals.yml", "- nope"),
      "VALIDATION_ERROR"
    ],
    [
      "directory portal path",
      async (workspace: string) => mkdir(path.join(workspace, "portals.yml"), { recursive: true }),
      "WORKSPACE_UNHEALTHY"
    ]
  ])("maps %s to a typed error", async (_name, setup, code) => {
    const workspace = await createTempWorkspace();
    await setup(workspace);

    await expect(createPortalFileAdapter(workspace).readPortalConfig()).rejects.toMatchObject({
      code
    } satisfies Partial<ApiError>);
  });

  it("maps unreadable portal files to a typed error", async () => {
    const workspace = await createTempWorkspace();
    const portalPath = path.join(workspace, "portals.yml");
    await writePortal(workspace, "portals.yml", "title_filter:\n  positive: [Mobile]\n");
    await chmod(portalPath, 0o000);

    try {
      await expect(createPortalFileAdapter(workspace).readPortalConfig()).rejects.toMatchObject({
        code: "WORKSPACE_UNHEALTHY"
      } satisfies Partial<ApiError>);
    } finally {
      await chmod(portalPath, 0o600);
    }
  });

  it("rejects symlinked portal files", async () => {
    const workspace = await createTempWorkspace();
    const outside = await mkdir(path.join(tmpdir(), `career-ops-portal-outside-${Date.now()}`), {
      recursive: true
    });
    tempDirs.push(outside);
    await writeFile(path.join(outside, "portals.yml"), "title_filter:\n  positive: [Outside]\n");
    await symlink(path.join(outside, "portals.yml"), path.join(workspace, "portals.yml"));

    await expect(createPortalFileAdapter(workspace).readPortalConfig()).rejects.toMatchObject({
      code: "PATH_OUTSIDE_WORKSPACE"
    } satisfies Partial<ApiError>);
  });

  it("saves to the first existing supported portal file and preserves provided unknown keys", async () => {
    const workspace = await createTempWorkspace();
    await writePortal(workspace, "portals.yaml", "title_filter:\n  positive: [Yaml]\n");
    await writePortal(workspace, "portals.yml", "title_filter:\n  positive: [Old]\n");

    const result = await createPortalFileAdapter(workspace).writePortalConfig({
      title_filter: {
        positive: ["New"]
      },
      tracked_companies: [
        {
          name: "OpenAI",
          careers_url: "https://openai.com/careers",
          enabled: true,
          parser: "keep-me"
        }
      ],
      unknown_top_level: "keep-me"
    });

    expect(result.relativePath).toBe("portals.yml");
    await expect(readFile(path.join(workspace, "portals.yaml"), "utf8")).resolves.toContain("Yaml");
    await expect(readFile(path.join(workspace, "portals.yml"), "utf8")).resolves.toContain(
      "unknown_top_level: keep-me"
    );
    await expect(readFile(path.join(workspace, "portals.yml"), "utf8")).resolves.toContain(
      "parser: keep-me"
    );
    await expect(readFile(path.join(workspace, "portals.yml.bak"), "utf8")).resolves.toContain(
      "Old"
    );
  });

  it("falls back to portals.yaml for save when portals.yml is missing", async () => {
    const workspace = await createTempWorkspace();
    await writePortal(workspace, "portals.yaml", "title_filter:\n  positive: [Old]\n");

    const result = await createPortalFileAdapter(workspace).writePortalConfig({
      title_filter: {
        positive: ["New"]
      }
    });

    expect(result.relativePath).toBe("portals.yaml");
    await expect(readFile(path.join(workspace, "portals.yaml"), "utf8")).resolves.toContain("New");
  });

  it("creates portals.yml when no supported portal file exists", async () => {
    const workspace = await createTempWorkspace();

    const result = await createPortalFileAdapter(workspace).writePortalConfig({
      title_filter: {
        positive: ["Mobile"]
      }
    });

    expect(result.relativePath).toBe("portals.yml");
    await expect(readFile(path.join(workspace, "portals.yml"), "utf8")).resolves.toContain("Mobile");
  });

  it("does not overwrite malformed existing portal YAML on save", async () => {
    const workspace = await createTempWorkspace();
    const portalPath = path.join(workspace, "portals.yml");
    await writePortal(workspace, "portals.yml", "title_filter: [");

    await expect(
      createPortalFileAdapter(workspace).writePortalConfig({
        title_filter: {
          positive: ["New"]
        }
      })
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    } satisfies Partial<ApiError>);
    await expect(readFile(portalPath, "utf8")).resolves.toBe("title_filter: [");
  });

  it("preserves the previous portal config when safe write fails", async () => {
    const workspace = await createTempWorkspace();
    const portalPath = path.join(workspace, "portals.yml");
    await writePortal(workspace, "portals.yml", "title_filter:\n  positive: [Stable]\n");
    await chmod(workspace, 0o555);

    try {
      await expect(
        createPortalFileAdapter(workspace).writePortalConfig({
          title_filter: {
            positive: ["New"]
          }
        })
      ).rejects.toMatchObject({
        code: "UNEXPECTED_ERROR"
      } satisfies Partial<ApiError>);
      await expect(readFile(portalPath, "utf8")).resolves.toContain("Stable");
    } finally {
      await chmod(workspace, 0o700);
    }
  });
});
