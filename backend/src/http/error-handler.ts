import { ERROR_STATUS, type ErrorCode, type ErrorResponseDto } from "@jobflow/contract";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { ApiError } from "./errors.js";

const FIXED_MESSAGES = {
  VALIDATION_ERROR: "The request is not valid.",
  NOT_FOUND: "Resource was not found.",
  PAYLOAD_TOO_LARGE: "The request is too large.",
  UNSUPPORTED_MEDIA_TYPE: "This content type is not supported.",
  UNEXPECTED_ERROR: "Something went wrong."
} as const satisfies Partial<Record<ErrorCode, string>>;

type FixedCode = keyof typeof FIXED_MESSAGES;

const fixedBody = (code: FixedCode): ErrorResponseDto => ({ error: { code, message: FIXED_MESSAGES[code] } });

function codeForClientError(statusCode: number): FixedCode {
  if (statusCode === 404) return "NOT_FOUND";
  if (statusCode === 413) return "PAYLOAD_TOO_LARGE";
  if (statusCode === 415) return "UNSUPPORTED_MEDIA_TYPE";
  return "VALIDATION_ERROR";
}

/** Answers every error with the contract's envelope. Text from an error never reaches a client unless it is an ApiError. */
export function registerErrorHandlers(server: FastifyInstance): void {
  server.setErrorHandler((error: FastifyError | Error, request, reply) => {
    if (error instanceof ApiError) {
      const body: ErrorResponseDto = {
        error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) }
      };
      return reply.status(error.status).send(body);
    }
    if (error instanceof ZodError) {
      const fields = [...new Set(error.issues.map((issue) => issue.path.join(".")))].filter(Boolean);
      const body = fixedBody("VALIDATION_ERROR");
      return reply.status(ERROR_STATUS.VALIDATION_ERROR).send({ error: { ...body.error, ...(fields.length > 0 ? { details: { fields } } : {}) } });
    }
    const { statusCode } = error as FastifyError;
    if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
      const code = codeForClientError(statusCode);
      return reply.status(ERROR_STATUS[code]).send(fixedBody(code));
    }
    request.log.error({ err: error }, "unexpected error");
    return reply.status(ERROR_STATUS.UNEXPECTED_ERROR).send(fixedBody("UNEXPECTED_ERROR"));
  });

  server.setNotFoundHandler((_request, reply) => reply.status(ERROR_STATUS.NOT_FOUND).send(fixedBody("NOT_FOUND")));
}

/**
 * For errors Fastify raises before routing, such as a malformed or overlong path, which
 * otherwise get its own body that echoes the path. No data is reachable this early, so
 * answering before authentication reveals nothing.
 */
export function frameworkErrorHandler(_error: FastifyError, _request: FastifyRequest, reply: FastifyReply): void {
  reply.status(ERROR_STATUS.VALIDATION_ERROR).send(fixedBody("VALIDATION_ERROR"));
}
