import { z } from "zod";
import { named } from "./common.js";

/** Each code and the HTTP status it is always sent with. */
export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  SIGN_IN_REQUIRED: 403,
  ENTITLEMENT_REQUIRED: 403,
  INTEGRITY_FAILED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  CV_UNREADABLE: 422,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 429,
  UNEXPECTED_ERROR: 500,
  AUTH_UNAVAILABLE: 503,
  UNAVAILABLE: 503
} as const;

export const ErrorCodeSchema = named(
  "ErrorCode",
  z.enum(Object.keys(ERROR_STATUS) as [keyof typeof ERROR_STATUS, ...(keyof typeof ERROR_STATUS)[]])
);

export const ErrorDtoSchema = named(
  "ErrorDto",
  z.strictObject({
    code: ErrorCodeSchema,
    message: z.string().min(1).max(500),
    details: z.record(z.string(), z.unknown()).optional()
  })
);

export const ErrorResponseDtoSchema = named("ErrorResponseDto", z.strictObject({ error: ErrorDtoSchema }));

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ErrorDto = z.infer<typeof ErrorDtoSchema>;
export type ErrorResponseDto = z.infer<typeof ErrorResponseDtoSchema>;
