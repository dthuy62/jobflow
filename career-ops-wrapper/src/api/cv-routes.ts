import type { FastifyInstance } from "fastify";
import { CvDtoSchema, type SaveCvRequestDto } from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import type { CvService } from "../services/cv-service.js";

export async function registerCvRoutes(
  server: FastifyInstance,
  cvService: CvService
): Promise<void> {
  server.get("/cv", async () => {
    return CvDtoSchema.parse(await cvService.getCv());
  });

  server.put("/cv", async (request) => {
    return CvDtoSchema.parse(await cvService.saveCv(parseSaveCvRequestBody(request.body)));
  });
}

function parseSaveCvRequestBody(body: unknown): SaveCvRequestDto {
  if (
    typeof body !== "object" ||
    body === null ||
    !("markdown" in body) ||
    typeof body.markdown !== "string"
  ) {
    throw new ApiError("VALIDATION_ERROR", "CV Markdown is invalid.");
  }

  return {
    markdown: body.markdown
  };
}
