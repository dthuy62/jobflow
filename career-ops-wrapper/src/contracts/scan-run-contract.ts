import { z } from "zod";
import { OpaqueIdSchema, SanitizedTextSchema } from "./shared-contract.js";

export const ScanRunStatusSchema = z.enum(["pending", "running", "succeeded", "failed", "cancelled", "unknown"]);
export const ScanRunStageSchema = z.enum(["queued", "executing", "parsing", "projecting", "completed", "failed"]);

const ScanRunFailureSchema = z.object({
  code: SanitizedTextSchema.describe("One of COMMAND_FAILED, COMMAND_TIMEOUT, SPAWN_FAILED."),
  message: SanitizedTextSchema.describe(
    "A fixed wrapper sentence, plus at most one fixed reason. Never raw scan output."
  )
});

export const ScanRunDtoSchema = z.object({
  id: OpaqueIdSchema,
  status: ScanRunStatusSchema,
  stage: ScanRunStageSchema,
  startedAt: z.iso.datetime().nullable().optional(),
  finishedAt: z.iso.datetime().nullable().optional(),
  exitCode: z.number().int().nullable().optional(),
  active: z.boolean(),
  summary: z.object({
    offersFound: z.number().int().nonnegative(),
    offersProjected: z
      .number()
      .int()
      .nonnegative()
      .describe(
        "New offers scan.mjs added (its `New offers added:` line), also when the run failed after writing them. 0 for dry runs."
      ),
    warnings: z
      .array(SanitizedTextSchema)
      .describe(
        "At most 20 fixed sentences built from portals.yml company names, an error category, and counts. Never raw scan output."
      )
  }),
  failure: ScanRunFailureSchema.nullable().optional(),
  sourceRevision: OpaqueIdSchema.optional()
});

export type ScanRunDto = z.infer<typeof ScanRunDtoSchema>;

export const SCAN_COMPANY_MAX_LENGTH = 100;

/**
 * Company names forwarded as the single argv element after `scan.mjs --company`
 * (never through a shell). Any text is a valid name; the only guards keep it
 * one safe argument: trimmed, not a flag, no control characters or line breaks.
 */
export const ScanCompanySchema = z
  .string()
  .trim()
  .min(1)
  .max(SCAN_COMPANY_MAX_LENGTH)
  .regex(/^(?!-)[^\p{Cc}\u2028\u2029]+$/u, "company must not start with '-' or contain control characters.");

export const StartScanRunRequestDtoSchema = z
  .object({
    dryRun: z.boolean().default(false),
    company: ScanCompanySchema.optional().describe(
      "Scan only this company (`scan.mjs --company <name>`). Any name of 1–100 characters after trimming; it must not start with '-' or contain control characters or line breaks. Passed as one argument, never through a shell."
    )
  })
  .strict();

export type StartScanRunRequestDto = z.infer<typeof StartScanRunRequestDtoSchema>;
