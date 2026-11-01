import type { FastifyInstance } from "fastify";
import {
  EvaluationDtoSchema,
  StartEvaluationRequestDtoSchema,
  type StartEvaluationRequestDto
} from "../contracts/index.js";
import { ApiError } from "../errors/api-error.js";
import type { EvaluationService } from "../services/evaluation-service.js";

const EVALUATION_ID = /^eval_\d{14}_[a-f0-9]{6}$/;

export async function registerEvaluationRoutes(
  server: FastifyInstance,
  evaluationService: EvaluationService
): Promise<void> {
  server.post("/evaluations", async (request, reply) => {
    const evaluation = await evaluationService.start(parseStartEvaluationBody(request.body));
    return reply.code(202).send(EvaluationDtoSchema.parse(evaluation));
  });

  server.get("/evaluations/latest", async () => {
    return EvaluationDtoSchema.parse(evaluationService.latest());
  });

  server.get<{ Params: { id: string } }>("/evaluations/:id", async (request) => {
    return EvaluationDtoSchema.parse(evaluationService.get(checkedId(request.params.id)));
  });

  server.post<{ Params: { id: string } }>("/evaluations/:id/cancel", async (request) => {
    return EvaluationDtoSchema.parse(evaluationService.cancel(checkedId(request.params.id)));
  });
}

function checkedId(id: string): string {
  if (!EVALUATION_ID.test(id)) {
    throw new ApiError("NOT_FOUND", "Evaluation was not found.");
  }
  return id;
}

function parseStartEvaluationBody(body: unknown): StartEvaluationRequestDto {
  const parsed = StartEvaluationRequestDtoSchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new ApiError("VALIDATION_ERROR", "Evaluation request is invalid.");
  }
  return parsed.data;
}
