import { createHash } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { access, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { CV_MARKDOWN_MAX_BYTES, CvDtoSchema, type CvDto } from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import { writeWorkspaceFileSafely } from "./safe-file-adapter.js";
import { isInsidePath, resolveWorkspaceRoot } from "./workspace-paths.js";

const CV_RELATIVE_PATH = "cv.md";

export interface CvFileAdapter {
  readCv(): Promise<CvDto>;
  writeCv(markdown: string): Promise<CvDto>;
}

export function createCvFileAdapter(workspacePath: string): CvFileAdapter {
  return {
    async readCv(): Promise<CvDto> {
      return readCvFromWorkspace(workspacePath);
    },

    async writeCv(markdown: string): Promise<CvDto> {
      const result = await writeWorkspaceFileSafely({
        workspacePath,
        relativePath: CV_RELATIVE_PATH,
        content: markdown
      });

      return toCvDto(markdown, await stat(result.targetPath));
    }
  };
}

async function readCvFromWorkspace(workspacePath: string): Promise<CvDto> {
  const targetPath = await resolveExistingCvPath(workspacePath);
  const fileStat = await stat(targetPath);

  if (fileStat.size > CV_MARKDOWN_MAX_BYTES) {
    throw new ApiError("PAYLOAD_TOO_LARGE", "CV Markdown must be 512 KiB or smaller.");
  }

  const markdown = await readFile(targetPath, "utf8");

  if (markdown.trim().length === 0) {
    throw new ApiError("VALIDATION_ERROR", "CV Markdown must not be blank.");
  }

  return toCvDto(markdown, fileStat);
}

function toCvDto(markdown: string, fileStat: Stats): CvDto {
  return CvDtoSchema.parse({
    markdown,
    sizeBytes: Buffer.byteLength(markdown, "utf8"),
    updatedAt: fileStat.mtime.toISOString(),
    sourceRevision: `cv_sha256_${createHash("sha256").update(markdown).digest("hex").slice(0, 8)}`
  });
}

async function resolveExistingCvPath(workspacePath: string): Promise<string> {
  const workspaceRoot = await resolveWorkspaceRoot(workspacePath).catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "Career Ops workspace is not ready.");
  });
  const targetPath = path.join(workspaceRoot, CV_RELATIVE_PATH);

  let targetRealPath: string;
  try {
    targetRealPath = await realpath(targetPath);
  } catch {
    throw new ApiError("NOT_FOUND", "CV Markdown file is missing.");
  }

  if (!isInsidePath(workspaceRoot, targetRealPath)) {
    throw new ApiError(
      "PATH_OUTSIDE_WORKSPACE",
      "Requested path is outside the configured Career Ops Workspace."
    );
  }

  const fileStat = await stat(targetRealPath);
  if (!fileStat.isFile()) {
    throw new ApiError("WORKSPACE_UNHEALTHY", "CV Markdown file is not readable.");
  }

  await access(targetRealPath, constants.R_OK).catch(() => {
    throw new ApiError("WORKSPACE_UNHEALTHY", "CV Markdown file is not readable.");
  });

  return targetRealPath;
}
