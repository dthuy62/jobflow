import { describe, expect, it } from "vitest";
import { OfferCollectionDtoSchema, OfferDtoSchema } from "../src/contracts/index.js";
import { createServer } from "../src/server.js";
import { projectionFixturePath } from "./support/fixture-workspace.js";

describe("offer routes", () => {
  it("serves the offer list and detail", async () => {
    const server = await createServer({
      config: { host: "127.0.0.1", port: 3000, workspace: projectionFixturePath }
    });

    try {
      const list = await server.inject({ method: "GET", url: "/api/v1/offers" });
      expect(list.statusCode).toBe(200);
      const collection = OfferCollectionDtoSchema.parse(list.json());
      expect(collection.items).toHaveLength(5);

      const firstId = collection.items[0]?.id as string;
      const detail = await server.inject({ method: "GET", url: `/api/v1/offers/${firstId}` });
      expect(detail.statusCode).toBe(200);
      expect(OfferDtoSchema.parse(detail.json()).id).toBe(firstId);

      for (const id of ["offer_0000000000000000", "offer-001", "..%2F..%2Fetc%2Fpasswd"]) {
        const missing = await server.inject({ method: "GET", url: `/api/v1/offers/${id}` });
        expect(missing.statusCode, id).toBe(404);
        expect(missing.json().error).toEqual({ code: "NOT_FOUND", message: "Offer was not found." });
      }
    } finally {
      await server.close();
    }
  });
});
