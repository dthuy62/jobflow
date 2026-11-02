import { z } from "zod";
import { OpaqueIdSchema, TimestampSchema, named } from "./common.js";

export const EvaluationStageSchema = named(
  "EvaluationStage",
  z.enum(["queued", "fetching_job", "analyzing", "writing_report", "done", "failed"])
);

const EvaluationResultSchema = z.strictObject({
  score: z.number().min(0).max(100),
  summary: z.string().min(1).max(2000),
  reportMarkdown: z.string().min(1).max(200_000),
  /** The app labels this as AI output. */
  aiGenerated: z.literal(true)
});

export const EvaluationDtoSchema = named(
  "EvaluationDto",
  z
    .strictObject({
      evaluationId: OpaqueIdSchema,
      jobId: OpaqueIdSchema,
      stage: EvaluationStageSchema,
      createdAt: TimestampSchema,
      updatedAt: TimestampSchema,
      result: EvaluationResultSchema.nullable(),
      failureMessage: z.string().min(1).max(500).nullable()
    })
    .refine(({ stage, result }) => (stage === "done") === (result !== null), {
      message: "result must be present exactly when the stage is done."
    })
    .refine(({ stage, failureMessage }) => (stage === "failed") === (failureMessage !== null), {
      message: "failureMessage must be present exactly when the stage is failed."
    })
);

export type EvaluationStage = z.infer<typeof EvaluationStageSchema>;
export type EvaluationDto = z.infer<typeof EvaluationDtoSchema>;
