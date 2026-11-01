import { z } from "zod";

/** Every readiness key the wrapper reports for AI evaluation. */
export const EVALUATION_REQUIREMENTS = [
  "evaluation.provider-not-configured",
  "evaluation.cli-missing",
  "evaluation.cli-logged-out",
  "evaluation.cli-check-failed",
  "cv.missing",
  "cv.too-large",
  "modes.shared-missing",
  "modes.offer-missing",
  "modes.too-large",
  "scripts.reserve-report-num-missing",
  "scripts.merge-tracker-missing",
  "tracker.missing"
] as const;

/**
 * `error.details` of the `evaluation-not-ready` 503. The route test parses real
 * responses with it and the contract example test parses the shared example,
 * so neither can drift from the other.
 */
export const EvaluationNotReadyDetailsSchema = z
  .object({
    reason: z.literal("evaluation-not-ready"),
    missingRequirements: z.array(z.enum(EVALUATION_REQUIREMENTS)).min(1)
  })
  .strict();
