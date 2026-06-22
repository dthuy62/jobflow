import { describe, expect, it } from "vitest";
import { ApiError } from "../src/errors/api-error.js";
import { mapErrorToResponse } from "../src/errors/error-mapper.js";

describe("error mapper", () => {
  it.each([
    ["VALIDATION_ERROR", 400],
    ["UNAUTHORIZED", 401],
    ["WORKSPACE_UNHEALTHY", 503],
    ["NOT_FOUND", 404],
    ["SCAN_ALREADY_RUNNING", 409],
    ["COMMAND_FAILED", 502],
    ["PARSER_FAILED", 422],
    ["PATH_OUTSIDE_WORKSPACE", 403],
    ["PAYLOAD_TOO_LARGE", 413],
    ["UNEXPECTED_ERROR", 500]
  ] as const)("maps %s to HTTP %s", (code, statusCode) => {
    const result = mapErrorToResponse(new ApiError(code, "Mapped error."));

    expect(result.statusCode).toBe(statusCode);
    expect(result.body.error.code).toBe(code);
  });

  it("maps unknown errors to unexpected server errors", () => {
    const result = mapErrorToResponse(new Error("boom"));

    expect(result.statusCode).toBe(500);
    expect(result.body.error.code).toBe("UNEXPECTED_ERROR");
  });
});
