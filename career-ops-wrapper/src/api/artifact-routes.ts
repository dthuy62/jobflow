import type { FastifyInstance } from "fastify";
import { ArtifactCollectionDtoSchema } from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import { ARTIFACT_CONTENT_TYPE } from "../outputs/index.js";
import type { ArtifactService } from "../services/artifact-service.js";

const ARTIFACT_ID = /^artifact_[a-f0-9]{16}$/;

export async function registerArtifactRoutes(
  server: FastifyInstance,
  artifactService: ArtifactService
): Promise<void> {
  server.get("/artifacts", async () => {
    return ArtifactCollectionDtoSchema.parse(await artifactService.listArtifacts());
  });

  server.get<{ Params: { id: string } }>("/artifacts/:id/download", async (request, reply) => {
    if (!ARTIFACT_ID.test(request.params.id)) {
      throw new ApiError("NOT_FOUND", "Artifact was not found.");
    }

    const download = await artifactService.openDownload(request.params.id);
    return reply
      .type(ARTIFACT_CONTENT_TYPE)
      .header("Content-Length", download.sizeBytes)
      .header("Content-Disposition", contentDisposition(download.fileName))
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", "no-store")
      .send(download.stream);
  });
}

function contentDisposition(fileName: string): string {
  const asciiName = fileName.replace(/[^A-Za-z0-9._-]/g, "_");
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
