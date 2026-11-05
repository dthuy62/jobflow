import { z } from "zod";
import { TimestampSchema, named, pageSchema } from "./common.js";
import { JobSummaryDtoSchema } from "./jobs.js";

export const TrackerStatusSchema = named("TrackerStatus", z.enum(["applied", "interview", "rejected", "skipped"]));

export const TrackerUpdateRequestSchema = named("TrackerUpdateRequest", z.strictObject({ status: TrackerStatusSchema }));

export const TrackerEntryDtoSchema = named(
  "TrackerEntryDto",
  z.strictObject({
    job: JobSummaryDtoSchema,
    status: TrackerStatusSchema,
    updatedAt: TimestampSchema
  })
);

export const TrackerPageDtoSchema = named("TrackerPageDto", pageSchema(TrackerEntryDtoSchema));

export type TrackerStatus = z.infer<typeof TrackerStatusSchema>;
export type TrackerUpdateRequest = z.infer<typeof TrackerUpdateRequestSchema>;
export type TrackerEntryDto = z.infer<typeof TrackerEntryDtoSchema>;
export type TrackerPageDto = z.infer<typeof TrackerPageDtoSchema>;
