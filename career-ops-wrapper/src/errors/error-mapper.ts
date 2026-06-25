import type { ErrorResponseDto } from "../contracts/index.js";
import { ApiError } from "./api-error.js";

export interface MappedApiError {
  readonly statusCode: number;
  readonly body: ErrorResponseDto;
}

const errorStatusByCode = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  WORKSPACE_UNHEALTHY: 503,
  NOT_FOUND: 404,
  SCAN_ALREADY_RUNNING: 409,
  COMMAND_FAILED: 502,
  PARSER_FAILED: 422,
  PATH_OUTSIDE_WORKSPACE: 403,
  PAYLOAD_TOO_LARGE: 413,
  UNEXPECTED_ERROR: 500
} as const;

export function mapErrorToResponse(error: unknown): MappedApiError {
  if (error instanceof ApiError) {
    return {
      statusCode: errorStatusByCode[error.code],
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {})
        }
      }
    };
  }

  if (isFastifyPayloadTooLargeError(error)) {
    return mapErrorToResponse(
      new ApiError("PAYLOAD_TOO_LARGE", "CV Markdown must be 512 KiB or smaller.")
    );
  }

  if (isFastifyClientParseError(error)) {
    return mapErrorToResponse(new ApiError("VALIDATION_ERROR", "Request body is invalid."));
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: "UNEXPECTED_ERROR",
        message: "An unexpected error occurred."
      }
    }
  };
}

function isFastifyPayloadTooLargeError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    error.statusCode === 413
  );
}

function isFastifyClientParseError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    error.statusCode === 400
  );
}
