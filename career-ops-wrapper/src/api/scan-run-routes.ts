import type { FastifyInstance } from "fastify";
import {
  ScanRunDtoSchema,
  StartScanRunRequestDtoSchema,
  type StartScanRunRequestDto
} from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import type { ScanRunService } from "../services/scan-run-service.js";

const SCAN_RUN_ID = /^scan_\d{14}_[a-f0-9]{6}$/;

export async function registerScanRunRoutes(
  server: FastifyInstance,
  scanRunService: ScanRunService
): Promise<void> {
  server.post("/scan-runs", async (request, reply) => {
    const run = await scanRunService.startScan(parseStartScanRunBody(request.body));
    return reply.code(202).send(ScanRunDtoSchema.parse(run));
  });

  server.get("/scan-runs/latest", async () => {
    return ScanRunDtoSchema.parse(scanRunService.getLatestScanRun());
  });

  server.get<{ Params: { id: string } }>("/scan-runs/:id", async (request) => {
    if (!SCAN_RUN_ID.test(request.params.id)) {
      throw new ApiError("NOT_FOUND", "Scan run was not found.");
    }
    return ScanRunDtoSchema.parse(scanRunService.getScanRun(request.params.id));
  });
}

function parseStartScanRunBody(body: unknown): StartScanRunRequestDto {
  const parsed = StartScanRunRequestDtoSchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new ApiError("VALIDATION_ERROR", "Scan request is invalid.");
  }
  return parsed.data;
}
