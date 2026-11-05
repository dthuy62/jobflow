import { z } from "zod";
import { NameSchema, OpaqueIdSchema, TimestampSchema, VendorTokenSchema, named } from "./common.js";

/**
 * Generic on purpose: a plan grants features and counters with a reset rule, so this can
 * back a subscription, consumable credits or both. The owner chooses before phase 3.
 */
export const EntitlementDtoSchema = named(
  "EntitlementDto",
  z.strictObject({
    plan: NameSchema,
    features: z.array(NameSchema),
    quotas: z.array(
      z.strictObject({
        feature: NameSchema,
        used: z.number().int().nonnegative(),
        limit: z.number().int().nonnegative(),
        /** Null for a counter that never resets, such as the free trial. */
        resetsAt: TimestampSchema.nullable()
      })
    )
  })
);

export const PurchaseRequestSchema = named(
  "PurchaseRequest",
  z.strictObject({
    productId: OpaqueIdSchema,
    purchaseToken: VendorTokenSchema
  })
);

export type EntitlementDto = z.infer<typeof EntitlementDtoSchema>;
export type PurchaseRequest = z.infer<typeof PurchaseRequestSchema>;
