import type { ErrorCode, ErrorDto } from "@jobflow/contract";

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
