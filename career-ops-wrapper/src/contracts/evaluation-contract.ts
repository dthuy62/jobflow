import { z } from "zod";
import { OpaqueIdSchema, SanitizedTextSchema } from "./shared-contract.js";

export const EvaluationStatusSchema = z.enum(["pending", "running", "succeeded", "failed", "cancelled"]);
export const EvaluationStageSchema = z.enum([
  "queued",
  "fetching-posting",
  "evaluating",
  "writing",
  "completed",
  "failed",
  "cancelled"
]);

/** Run failure codes; a run field like `ScanRunDto.failure.code`, not an API error code. */
export const EVALUATION_FAILURE_CODES = [
  "POSTING_UNAVAILABLE",
  "CLI_NOT_LOGGED_IN",
  "CLI_LIMIT_REACHED",
  "COMMAND_TIMEOUT",
  "COMMAND_FAILED",
  "SPAWN_FAILED",
  "OUTPUT_INVALID",
  "WRITE_FAILED",
  "CANCELLED"
] as const;

export const EvaluationFailureCodeSchema = z.enum(EVALUATION_FAILURE_CODES);
export type EvaluationFailureCode = z.infer<typeof EvaluationFailureCodeSchema>;

export const EVALUATION_WARNINGS_LIMIT = 10;

export const EvaluationDtoSchema = z.object({
  id: OpaqueIdSchema,
  offerId: OpaqueIdSchema,
  provider: z.enum(["claude"]),
  status: EvaluationStatusSchema,
  stage: EvaluationStageSchema,
  active: z.boolean(),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  result: z
    .object({
      reportId: OpaqueIdSchema,
      /** Same 0–100 mapping as `OfferDto.score`. */
      score: z.number().min(0).max(100),
      artifactIds: z.array(OpaqueIdSchema)
    })
    .nullable(),
  warnings: z
    .array(SanitizedTextSchema)
    .max(EVALUATION_WARNINGS_LIMIT)
    .describe("Fixed wrapper sentences only. Never CLI output."),
  failure: z
    .object({
      code: EvaluationFailureCodeSchema,
      message: SanitizedTextSchema.describe("A fixed wrapper sentence. Never CLI output.")
    })
    .nullable()
});

export type EvaluationDto = z.infer<typeof EvaluationDtoSchema>;

export const StartEvaluationRequestDtoSchema = z.object({ offerId: OpaqueIdSchema }).strict();
export type StartEvaluationRequestDto = z.infer<typeof StartEvaluationRequestDtoSchema>;

export const EVALUATION_LEGITIMACY = ["High Confidence", "Proceed with Caution", "Suspicious"] as const;
export const EVALUATION_NOTE_MAX_LENGTH = 160;
export const EVALUATION_REPORT_MIN_LENGTH = 200;
export const EVALUATION_REPORT_MAX_LENGTH = 120_000;

/** The JSON object the AI CLI must print. Validated here whatever the CLI enforces. */
export const EvaluationModelOutputSchema = z
  .object({
    score: z.number().min(0).max(5),
    legitimacy: z.enum(EVALUATION_LEGITIMACY),
    note: z.string().trim().min(1).max(EVALUATION_NOTE_MAX_LENGTH),
    reportMarkdown: z.string().min(EVALUATION_REPORT_MIN_LENGTH).max(EVALUATION_REPORT_MAX_LENGTH)
  })
  .strict();

export type EvaluationModelOutput = z.infer<typeof EvaluationModelOutputSchema>;

/** JSON Schema passed to the CLI (`--json-schema`); mirrors {@link EvaluationModelOutputSchema}. */
export const EVALUATION_OUTPUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["score", "legitimacy", "note", "reportMarkdown"],
  properties: {
    score: { type: "number", minimum: 0, maximum: 5 },
    legitimacy: { enum: [...EVALUATION_LEGITIMACY] },
    note: { type: "string", minLength: 1, maxLength: EVALUATION_NOTE_MAX_LENGTH },
    reportMarkdown: {
      type: "string",
      minLength: EVALUATION_REPORT_MIN_LENGTH,
      maxLength: EVALUATION_REPORT_MAX_LENGTH
    }
  }
} as const;
