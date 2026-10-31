import type { RuntimeConfig } from "../config/runtime-config.js";
import type { ArtifactCollectionDto } from "../contracts/index.js";
import {
  ARTIFACT_CONTENT_TYPE,
  openArtifactForDownload,
  type ArtifactDownload
} from "../outputs/index.js";
import { readCareerOpsData } from "../workspace/career-ops-data-adapter.js";
import { projectCareerOps } from "./career-ops-projection.js";

export interface ArtifactService {
  listArtifacts(): Promise<ArtifactCollectionDto>;
  openDownload(id: string): Promise<ArtifactDownload>;
}

export function createArtifactService(config: RuntimeConfig): ArtifactService {
  return {
    async listArtifacts(): Promise<ArtifactCollectionDto> {
      const data = await readCareerOpsData(config.workspace, { tolerateOversizedSources: true });
      const { offerIdByReportId, reportIdByArtifactFileName } = projectCareerOps(data);

      return {
        items: data.artifacts.map((artifact) => {
          const reportId = reportIdByArtifactFileName.get(artifact.fileName) ?? null;
          return {
            id: artifact.id,
            offerId: reportId ? (offerIdByReportId.get(reportId) ?? null) : null,
            reportId,
            filename: artifact.fileName,
            contentType: ARTIFACT_CONTENT_TYPE,
            sizeBytes: artifact.sizeBytes,
            downloadUrl: `/api/v1/artifacts/${artifact.id}/download`,
            createdAt: artifact.mtime.toISOString()
          };
        }),
        syncedAt: new Date().toISOString(),
        sourceRevision: `artifacts_sha256_${data.revisionHash}`
      };
    },

    async openDownload(id: string): Promise<ArtifactDownload> {
      return openArtifactForDownload(config.workspace, id);
    }
  };
}
