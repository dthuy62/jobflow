import type { RuntimeConfig } from "../config/runtime-config.js";
import type { OfferCollectionDto, OfferDto } from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import { readCareerOpsData } from "../workspace/career-ops-data-adapter.js";
import { projectCareerOps } from "./career-ops-projection.js";

export interface OfferService {
  listOffers(): Promise<OfferCollectionDto>;
  getOffer(id: string): Promise<OfferDto>;
}

export function createOfferService(config: RuntimeConfig): OfferService {
  return {
    async listOffers(): Promise<OfferCollectionDto> {
      const data = await readCareerOpsData(config.workspace);
      return {
        items: projectCareerOps(data).offers,
        syncedAt: new Date().toISOString(),
        sourceRevision: `offers_sha256_${data.revisionHash}`
      };
    },

    async getOffer(id: string): Promise<OfferDto> {
      const offers = projectCareerOps(await readCareerOpsData(config.workspace)).offers;
      const offer = offers.find((candidate) => candidate.id === id);
      if (!offer) {
        throw new ApiError("NOT_FOUND", "Offer was not found.");
      }
      return offer;
    }
  };
}
