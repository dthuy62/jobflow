import type { FastifyInstance } from "fastify";
import { OfferCollectionDtoSchema, OfferDtoSchema } from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import type { OfferService } from "../services/offer-service.js";

const OFFER_ID = /^offer_[a-f0-9]{16}$/;

export async function registerOfferRoutes(
  server: FastifyInstance,
  offerService: OfferService
): Promise<void> {
  server.get("/offers", async () => {
    return OfferCollectionDtoSchema.parse(await offerService.listOffers());
  });

  server.get<{ Params: { id: string } }>("/offers/:id", async (request) => {
    if (!OFFER_ID.test(request.params.id)) {
      throw new ApiError("NOT_FOUND", "Offer was not found.");
    }
    return OfferDtoSchema.parse(await offerService.getOffer(request.params.id));
  });
}
