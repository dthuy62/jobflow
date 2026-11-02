import { z } from "zod";
import { VendorTokenSchema, named } from "./common.js";

export const DeviceUpdateRequestSchema = named("DeviceUpdateRequest", z.strictObject({ fcmToken: VendorTokenSchema }));

export type DeviceUpdateRequest = z.infer<typeof DeviceUpdateRequestSchema>;
