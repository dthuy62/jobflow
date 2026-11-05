import type { FastifyInstance } from "fastify";
import { ReportCollectionDtoSchema, ReportDetailDtoSchema } from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import type { ReportService } from "../services/report-service.js";

const REPORT_ID = /^report_\d{3,6}$/;

export async function registerReportRoutes(
  server: FastifyInstance,
  reportService: ReportService
): Promise<void> {
  server.get("/reports", async () => {
    return ReportCollectionDtoSchema.parse(await reportService.listReports());
  });

  server.get<{ Params: { id: string } }>("/reports/:id", async (request) => {
    if (!REPORT_ID.test(request.params.id)) {
      throw new ApiError("NOT_FOUND", "Report was not found.");
    }
    return ReportDetailDtoSchema.parse(await reportService.getReport(request.params.id));
  });
}
