import { ERROR_STATUS, type ErrorCode, type ErrorResponseDto } from "@jobflow/contract";
import type { Socket } from "node:net";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
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
    // Only Fastify's own errors are about the request. The same status on another error,
    // such as from a vendor's SDK, is a server-side failure.
    const { code: errorCode, statusCode } = (error ?? {}) as Partial<FastifyError>;
    if (errorCode?.startsWith("FST_") && statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
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
export function frameworkErrorHandler(_error: FastifyError, request: FastifyRequest, reply: FastifyReply): void {
  // The onResponse hook does not run for these, so this request logs here.
  request.log.info({ method: request.method, route: "unmatched", status: ERROR_STATUS.VALIDATION_ERROR }, "request");
  reply.status(ERROR_STATUS.VALIDATION_ERROR).send(fixedBody("VALIDATION_ERROR"));
}

/** For a request too malformed to parse. Fastify's default body is not the contract's envelope. */
export function clientErrorHandler(error: NodeJS.ErrnoException, socket: Socket): void {
  if (error.code === "ECONNRESET" || socket.destroyed) return;
  const body = JSON.stringify(fixedBody("VALIDATION_ERROR"));
  socket.end(
    `HTTP/1.1 ${ERROR_STATUS.VALIDATION_ERROR} Bad Request\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`
  );
}
