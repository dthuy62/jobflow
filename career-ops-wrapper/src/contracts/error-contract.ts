import { z } from "zod";

export const ErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "WORKSPACE_UNHEALTHY",
  "NOT_FOUND",
  "SCAN_ALREADY_RUNNING",
  "COMMAND_FAILED",
  "PARSER_FAILED",
  "PATH_OUTSIDE_WORKSPACE",
  "PAYLOAD_TOO_LARGE",
  "UNEXPECTED_ERROR"
]);

export const ErrorDtoSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional()
});

export const ErrorResponseDtoSchema = z.object({
  error: ErrorDtoSchema
});

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ErrorDto = z.infer<typeof ErrorDtoSchema>;
export type ErrorResponseDto = z.infer<typeof ErrorResponseDtoSchema>;
