import type { ErrorCode, ErrorDto } from "@jobflow/contract";
import type { z } from "zod";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDto["details"]
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Parses what a client sent. Any other ZodError, such as from stored data that fails a
 * response schema, is the server's fault and becomes a logged 500.
 */
export function parseRequest<Schema extends z.ZodType>(schema: Schema, value: unknown): z.output<Schema> {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))].filter(Boolean);
  throw new ApiError(400, "VALIDATION_ERROR", "The request is not valid.", fields.length > 0 ? { fields } : undefined);
}
