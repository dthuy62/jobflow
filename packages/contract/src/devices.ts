import { z } from "zod";
import { VendorTokenSchema, named } from "./common.js";

/** Registering one more removes the user's oldest, so a script cannot grow this without bound. */
export const DEVICE_MAX_PER_USER = 10;

export const DeviceUpdateRequestSchema = named("DeviceUpdateRequest", z.strictObject({ fcmToken: VendorTokenSchema }));

export type DeviceUpdateRequest = z.infer<typeof DeviceUpdateRequestSchema>;
