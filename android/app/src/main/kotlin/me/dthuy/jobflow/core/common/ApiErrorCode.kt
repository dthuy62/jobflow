package me.dthuy.jobflow.core.common

/**
 * Mirror of the wrapper's `ErrorCodeSchema` (`career-ops-wrapper/src/contracts/error-contract.ts`).
 * `ApiErrorCodeContractTest` fails when the two drift; codes added later by the wrapper map to [UNKNOWN].
 */
enum class ApiErrorCode {
    VALIDATION_ERROR,
    UNAUTHORIZED,
    WORKSPACE_UNHEALTHY,
    NOT_FOUND,
    SCAN_ALREADY_RUNNING,
    EVALUATION_ALREADY_RUNNING,
    COMMAND_FAILED,
    PARSER_FAILED,
    PATH_OUTSIDE_WORKSPACE,
    PAYLOAD_TOO_LARGE,
    UNEXPECTED_ERROR,
    UNKNOWN,
}

fun String?.toApiErrorCode(): ApiErrorCode =
    ApiErrorCode.entries.firstOrNull { it.name == this } ?: ApiErrorCode.UNKNOWN
