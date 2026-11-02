import { z } from "zod";
import { NameSchema, TimestampSchema, named, pageSchema } from "./common.js";
import { JobSummaryDtoSchema } from "./jobs.js";
import { TrackerStatusSchema } from "./tracker.js";

/** One job that matches the user, and why. Newest and best first. */
export const FeedItemDtoSchema = named(
  "FeedItemDto",
  z.strictObject({
    job: JobSummaryDtoSchema,
    reasons: z.array(NameSchema).min(1).max(10),
    trackerStatus: TrackerStatusSchema.nullable(),
    matchedAt: TimestampSchema
  })
);

export const FeedPageDtoSchema = named("FeedPageDto", pageSchema(FeedItemDtoSchema));

export type FeedItemDto = z.infer<typeof FeedItemDtoSchema>;
export type FeedPageDto = z.infer<typeof FeedPageDtoSchema>;
