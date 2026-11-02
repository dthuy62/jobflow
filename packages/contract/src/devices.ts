import { z } from "zod";
import { named } from "./common.js";

export const DeviceUpdateRequestSchema = named("DeviceUpdateRequest", z.strictObject({ fcmToken: z.string().min(1).max(4096) }));

export type DeviceUpdateRequest = z.infer<typeof DeviceUpdateRequestSchema>;
