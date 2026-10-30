import { createHash } from "node:crypto";
import { constants, type ReadStream } from "node:fs";
import { open } from "node:fs/promises";
import { ApiError } from "../errors/api-error.js";
import { listWorkspaceFiles } from "../workspace/workspace-reader.js";

const OUTPUT_DIR = "output";

export const ARTIFACT_CONTENT_TYPE = "application/pdf";

export interface ArtifactFile {
  readonly id: string;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly mtime: Date;
}

export interface ArtifactDownload {
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly stream: ReadStream;
}

export function artifactIdForFileName(fileName: string): string {
  return `artifact_${createHash("sha256").update(`output:${fileName}`).digest("hex").slice(0, 16)}`;
}

/** Lists regular, non-symlink PDFs directly inside `output/`. */
export async function listArtifactFiles(workspacePath: string): Promise<ArtifactFile[]> {
  const entries = await listWorkspaceFiles(workspacePath, OUTPUT_DIR, isPdfFileName);

  return entries.map((entry) => ({
    id: artifactIdForFileName(entry.name),
    fileName: entry.name,
    sizeBytes: entry.sizeBytes,
    mtime: entry.mtime
  }));
}

/**
 * Opens a listed artifact for streaming. The ID is matched against the
 * listing, never joined into a path; the file is opened with `O_NOFOLLOW`.
 */
export async function openArtifactForDownload(
  workspacePath: string,
  artifactId: string
): Promise<ArtifactDownload> {
  const entries = await listWorkspaceFiles(workspacePath, OUTPUT_DIR, isPdfFileName);
  const entry = entries.find((candidate) => artifactIdForFileName(candidate.name) === artifactId);
  if (!entry) {
    throw artifactNotFound();
  }

  const handle = await open(entry.realPath, constants.O_RDONLY | constants.O_NOFOLLOW).catch(() => {
    throw artifactNotFound();
  });

  try {
    const fileStat = await handle.stat();
    // Same inode as at listing time: the file (or a parent) was not swapped in between.
    if (!fileStat.isFile() || fileStat.dev !== entry.dev || fileStat.ino !== entry.ino) {
      throw artifactNotFound();
    }

    return {
      fileName: entry.name,
      sizeBytes: fileStat.size,
      stream: handle.createReadStream({ autoClose: true })
    };
  } catch (error) {
    await handle.close().catch(() => undefined);
    throw error;
  }
}

function isPdfFileName(name: string): boolean {
  return /\.pdf$/i.test(name) && !name.startsWith(".");
}

function artifactNotFound(): ApiError {
  return new ApiError("NOT_FOUND", "Artifact was not found.");
}
