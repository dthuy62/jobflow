import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CV_MARKDOWN_MAX_BYTES, CvDtoSchema, ErrorResponseDtoSchema } from "../src/contracts/index.js";
import { createServer } from "../src/server.js";

const tempDirs: string[] = [];

async function createTempWorkspace(): Promise<string> {
  const workspace = await mkdir(path.join(tmpdir(), `career-ops-cv-route-${Date.now()}`), {
    recursive: true
  });
  tempDirs.push(workspace);
  return workspace;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("CV routes", () => {
  it("serves CV Markdown under /api/v1/cv", async () => {
    const workspace = await createTempWorkspace();
    await writeFile(path.join(workspace, "cv.md"), "# Current CV");
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/cv"
      });

      expect(response.statusCode).toBe(200);
      expect(CvDtoSchema.parse(response.json()).markdown).toBe("# Current CV");
    } finally {
      await server.close();
    }
  });

  it("saves CV Markdown under /api/v1/cv", async () => {
    const workspace = await createTempWorkspace();
    await writeFile(path.join(workspace, "cv.md"), "# Old CV");
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/cv",
        payload: { markdown: "# Saved CV" }
      });

      expect(response.statusCode).toBe(200);
      expect(CvDtoSchema.parse(response.json()).markdown).toBe("# Saved CV");
      await expect(readFile(path.join(workspace, "cv.md"), "utf8")).resolves.toBe("# Saved CV");
    } finally {
      await server.close();
    }
  });

  it("maps invalid CV save payloads to typed errors", async () => {
    const workspace = await createTempWorkspace();
    await writeFile(path.join(workspace, "cv.md"), "# Existing CV");
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/cv",
        payload: { markdown: "   " }
      });

      expect(response.statusCode).toBe(400);
      expect(ErrorResponseDtoSchema.parse(response.json()).error.code).toBe("VALIDATION_ERROR");
      await expect(readFile(path.join(workspace, "cv.md"), "utf8")).resolves.toBe("# Existing CV");
    } finally {
      await server.close();
    }
  });

  it("maps oversized CV save payloads to payload-too-large errors", async () => {
    const workspace = await createTempWorkspace();
    await writeFile(path.join(workspace, "cv.md"), "# Existing CV");
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/cv",
        payload: { markdown: "a".repeat(512 * 1024 + 1) }
      });

      expect(response.statusCode).toBe(413);
      expect(ErrorResponseDtoSchema.parse(response.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
      await expect(readFile(path.join(workspace, "cv.md"), "utf8")).resolves.toBe("# Existing CV");
    } finally {
      await server.close();
    }
  });

  it("maps parser-level oversized bodies to payload-too-large errors", async () => {
    const workspace = await createTempWorkspace();
    await writeFile(path.join(workspace, "cv.md"), "# Existing CV");
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/cv",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ markdown: "a".repeat(1024 * 1024 + 1) })
      });

      expect(response.statusCode).toBe(413);
      expect(ErrorResponseDtoSchema.parse(response.json()).error.code).toBe("PAYLOAD_TOO_LARGE");
      await expect(readFile(path.join(workspace, "cv.md"), "utf8")).resolves.toBe("# Existing CV");
    } finally {
      await server.close();
    }
  });

  it("maps invalid JSON bodies to validation errors", async () => {
    const workspace = await createTempWorkspace();
    await writeFile(path.join(workspace, "cv.md"), "# Existing CV");
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace }
    });

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/api/v1/cv",
        headers: { "content-type": "application/json" },
        payload: "{"
      });

      expect(response.statusCode).toBe(400);
      expect(ErrorResponseDtoSchema.parse(response.json()).error.code).toBe("VALIDATION_ERROR");
    } finally {
      await server.close();
    }
  });

  it("protects CV routes with the local pairing token in LAN mode", async () => {
    const workspace = await createTempWorkspace();
    await writeFile(path.join(workspace, "cv.md"), "# Current CV");
    const server = await createServer({
      config: {
        host: "0.0.0.0",
        port: 3000,
        workspace,
        pairingToken: "local-secret"
      }
    });

    try {
      const unauthorized = await server.inject({
        method: "GET",
        url: "/api/v1/cv"
      });
      const authorized = await server.inject({
        method: "GET",
        url: "/api/v1/cv",
        headers: { "x-career-ops-token": "local-secret" }
      });

      expect(unauthorized.statusCode).toBe(401);
      expect(ErrorResponseDtoSchema.parse(unauthorized.json()).error.code).toBe("UNAUTHORIZED");
      expect(authorized.statusCode).toBe(200);
    } finally {
      await server.close();
    }
  });
  // These statuses are documented in OpenAPI for the CV routes.
  it.each([
    { method: "GET", status: 400, code: "VALIDATION_ERROR", cv: "blank" },
    { method: "GET", status: 403, code: "PATH_OUTSIDE_WORKSPACE", cv: "outside" },
    { method: "GET", status: 413, code: "PAYLOAD_TOO_LARGE", cv: "oversized" },
    { method: "PUT", status: 403, code: "PATH_OUTSIDE_WORKSPACE", cv: "outside" }
  ] as const)("returns $status $code on $method when cv.md is $cv", async ({ method, status, code, cv }) => {
    const workspace = await mkdtemp(path.join(tmpdir(), "career-ops-cv-route-"));
    const outside = await mkdtemp(path.join(tmpdir(), "career-ops-cv-outside-"));
    tempDirs.push(workspace, outside);
    const cvPath = path.join(workspace, "cv.md");
    if (cv === "blank") {
      await writeFile(cvPath, "  \n");
    } else if (cv === "oversized") {
      await writeFile(cvPath, "#".repeat(CV_MARKDOWN_MAX_BYTES + 1));
    } else {
      await writeFile(path.join(outside, "cv.md"), "# Outside CV");
      await symlink(path.join(outside, "cv.md"), cvPath);
    }
    const server = await createServer({ config: { host: "127.0.0.1", port: 3000, workspace } });

    try {
      const response = await server.inject({
        method,
        url: "/api/v1/cv",
        ...(method === "PUT" ? { payload: { markdown: "# New CV" } } : {})
      });

      expect(response.statusCode).toBe(status);
      expect(ErrorResponseDtoSchema.parse(response.json()).error.code).toBe(code);
      if (cv === "outside") {
        expect(await readFile(path.join(outside, "cv.md"), "utf8")).toBe("# Outside CV");
      }
    } finally {
      await server.close();
    }
  });
});
