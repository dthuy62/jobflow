import { z } from "zod";

export const ServiceStatusSchema = z.enum(["ready", "degraded", "notReady"]);
export const WorkspaceStatusSchema = z.enum(["ready", "missing", "invalid", "unknown"]);
export const CareerOpsReadinessStatusSchema = z.enum(["ready", "notReady"]);
export const ScriptCheckStatusSchema = z.enum(["ready", "missing", "invalid"]);

export const HealthCapabilitiesDtoSchema = z.object({
  cv: z.boolean(),
  profile: z.boolean(),
  portals: z.boolean(),
  scan: z.boolean(),
  reports: z.boolean(),
  artifacts: z.boolean(),
  cvConversion: z.boolean(),
  geminiEvaluation: z.boolean()
});

export const WorkspaceHealthDtoSchema = z.object({
  status: WorkspaceStatusSchema,
  detected: z.boolean(),
  careerOpsVersion: z.string().min(1).nullable().optional(),
  missingRequirements: z.array(z.string()),
  messages: z.array(z.string())
});

export const ScriptReadinessCheckDtoSchema = z.object({
  name: z.enum(["doctor-script", "scan-script", "portal-config"]),
  status: ScriptCheckStatusSchema
});

export const ScannerReadinessDtoSchema = z.object({
  status: CareerOpsReadinessStatusSchema,
  commandType: z.literal("local-script"),
  missingRequirements: z.array(z.string()),
  checks: z.array(ScriptReadinessCheckDtoSchema),
  messages: z.array(z.string())
});

export const CareerOpsReadinessDtoSchema = z.object({
  status: CareerOpsReadinessStatusSchema,
  executionMode: z.literal("local-script-runner"),
  providerApiKeyRequired: z.literal(false),
  aiCliRequired: z.literal(false),
  scanner: ScannerReadinessDtoSchema
});

export const HealthDtoSchema = z.object({
  status: ServiceStatusSchema,
  apiVersion: z.literal("v1"),
  workspace: WorkspaceHealthDtoSchema,
  careerOps: CareerOpsReadinessDtoSchema,
  capabilities: HealthCapabilitiesDtoSchema,
  serverTime: z.iso.datetime()
});

export type HealthCapabilitiesDto = z.infer<typeof HealthCapabilitiesDtoSchema>;
export type WorkspaceHealthDto = z.infer<typeof WorkspaceHealthDtoSchema>;
export type ScriptReadinessCheckDto = z.infer<typeof ScriptReadinessCheckDtoSchema>;
export type ScannerReadinessDto = z.infer<typeof ScannerReadinessDtoSchema>;
export type CareerOpsReadinessDto = z.infer<typeof CareerOpsReadinessDtoSchema>;
export type HealthDto = z.infer<typeof HealthDtoSchema>;
