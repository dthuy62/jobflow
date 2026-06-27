import { z } from "zod";
import { ErrorCodeSchema } from "./error-contract.js";

export const ScanReadinessStatusSchema = z.enum(["ready", "notReady"]);
export const ScanReadinessCheckNameSchema = z.enum([
  "wrapper",
  "workspace",
  "scanner",
  "cv",
  "profile",
  "portal"
]);

const SourceRevisionSchema = z.string().regex(/^(cv|profile|portals)_sha256_[a-f0-9]{8}$/);

export const ScanReadinessCheckDtoSchema = z.object({
  name: ScanReadinessCheckNameSchema,
  status: ScanReadinessStatusSchema,
  message: z.string().min(1),
  requirement: z.string().min(1).optional(),
  sourceRevision: SourceRevisionSchema.optional(),
  updatedAt: z.iso.datetime().nullable().optional(),
  details: z
    .object({
      code: ErrorCodeSchema.optional(),
      missingRequirements: z.array(z.string().min(1)).optional()
    })
    .optional()
});

export const ScanReadinessDtoSchema = z
  .object({
    status: ScanReadinessStatusSchema,
    canStartScan: z.boolean(),
    computedAt: z.iso.datetime(),
    checks: z.array(ScanReadinessCheckDtoSchema).length(6),
    missingRequirements: z.array(z.string().min(1))
  })
  .superRefine((value, context) => {
    const names = new Set(value.checks.map((check) => check.name));
    for (const name of ScanReadinessCheckNameSchema.options) {
      if (!names.has(name)) {
        context.addIssue({
          code: "custom",
          path: ["checks"],
          message: `Missing ${name} readiness check.`
        });
      }
    }

    const allReady = value.checks.every((check) => check.status === "ready");
    if (value.status === "ready" !== value.canStartScan || value.status === "ready" !== allReady) {
      context.addIssue({
        code: "custom",
        path: ["canStartScan"],
        message: "canStartScan must be true only when every readiness check is ready."
      });
    }
  });

export type ScanReadinessStatus = z.infer<typeof ScanReadinessStatusSchema>;
export type ScanReadinessCheckName = z.infer<typeof ScanReadinessCheckNameSchema>;
export type ScanReadinessCheckDto = z.infer<typeof ScanReadinessCheckDtoSchema>;
export type ScanReadinessDto = z.infer<typeof ScanReadinessDtoSchema>;
