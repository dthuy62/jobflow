import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RuntimeConfig } from "../src/config/runtime-config.js";
import { ApiError } from "../src/errors/api-error.js";
import { createCvService } from "../src/services/cv-service.js";

const tempDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const workspace = await mkdir(path.join(tmpdir(), `career-ops-cv-service-${Date.now()}`), {
    recursive: true
  });
  tempDirs.push(workspace);
  return workspace;
}

function configFor(workspace: string): RuntimeConfig {
  return {
    host: "127.0.0.1",
    port: 3000,
    workspace
  };
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("CV service", () => {
  it("reads existing CV Markdown unchanged", async () => {
    const workspace = await createTempWorkspace();
    await writeFile(path.join(workspace, "cv.md"), "# Hy\n\nCV content.");

    const cv = await createCvService(configFor(workspace)).getCv();

    expect(cv.markdown).toBe("# Hy\n\nCV content.");
    expect(cv.sizeBytes).toBe(Buffer.byteLength(cv.markdown, "utf8"));
    expect(cv.sourceRevision).toMatch(/^cv_sha256_[a-f0-9]{8}$/);
  });

  it("returns a typed error when cv.md is missing", async () => {
    const workspace = await createTempWorkspace();

    await expect(createCvService(configFor(workspace)).getCv()).rejects.toMatchObject({
      code: "NOT_FOUND"
    } satisfies Partial<ApiError>);
  });

  it("returns typed errors when existing cv.md is blank or oversized", async () => {
    const workspace = await createTempWorkspace();
    const cvPath = path.join(workspace, "cv.md");
    const service = createCvService(configFor(workspace));

    await writeFile(cvPath, "  \n");
    await expect(service.getCv()).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    } satisfies Partial<ApiError>);

    await writeFile(cvPath, "a".repeat(512 * 1024 + 1));
    await expect(service.getCv()).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE"
    } satisfies Partial<ApiError>);
  });

  it("rejects blank and oversized saves before modifying cv.md", async () => {
    const workspace = await createTempWorkspace();
    const cvPath = path.join(workspace, "cv.md");
    await writeFile(cvPath, "# Existing CV");
    const service = createCvService(configFor(workspace));

    await expect(service.saveCv({ markdown: "  \n\t" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    } satisfies Partial<ApiError>);
    await expect(service.saveCv({ markdown: "a".repeat(512 * 1024 + 1) })).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE"
    } satisfies Partial<ApiError>);
    await expect(readFile(cvPath, "utf8")).resolves.toBe("# Existing CV");
  });

  it("saves valid Markdown and returns the saved DTO", async () => {
    const workspace = await createTempWorkspace();
    const cvPath = path.join(workspace, "cv.md");
    await writeFile(cvPath, "# Old CV");

    const cv = await createCvService(configFor(workspace)).saveCv({
      markdown: "# New CV"
    });

    expect(cv.markdown).toBe("# New CV");
    expect(cv.sizeBytes).toBe(Buffer.byteLength("# New CV", "utf8"));
    await expect(readFile(cvPath, "utf8")).resolves.toBe("# New CV");
    await expect(readFile(path.join(workspace, "cv.md.bak"), "utf8")).resolves.toBe("# Old CV");
  });

  it("returns each saved Markdown when concurrent saves target the same CV", async () => {
    const workspace = await createTempWorkspace();
    const service = createCvService(configFor(workspace));
    const saves = Array.from({ length: 20 }, (_, index) => `# Concurrent CV ${index}\n${"x".repeat(1000)}`);

    const results = await Promise.all(
      saves.map(async (markdown) => (await service.saveCv({ markdown })).markdown)
    );

    expect(results).toEqual(saves);
  });

  it("treats command-like Markdown as inert text", async () => {
    const workspace = await createTempWorkspace();
    const commandLikeMarkdown = "```sh\nrm -rf /tmp/not-run\n```";

    const cv = await createCvService(configFor(workspace)).saveCv({
      markdown: commandLikeMarkdown
    });

    expect(cv.markdown).toBe(commandLikeMarkdown);
    await expect(readFile(path.join(workspace, "cv.md"), "utf8")).resolves.toBe(commandLikeMarkdown);
  });
});
