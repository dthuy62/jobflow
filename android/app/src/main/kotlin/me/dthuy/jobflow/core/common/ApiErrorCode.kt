package me.dthuy.jobflow.core.common

/**
 * Mirror of the hosted API's error codes (`contracts/error-codes.json` at the repo root).
 * `ApiErrorCodeContractTest` fails when the two drift; codes a newer API adds map to [UNKNOWN].
 */
enum class ApiErrorCode {
    VALIDATION_ERROR,
    UNAUTHORIZED,
    SIGN_IN_REQUIRED,
    ENTITLEMENT_REQUIRED,
    INTEGRITY_FAILED,
    NOT_FOUND,
    CONFLICT,
    PAYLOAD_TOO_LARGE,
    UNSUPPORTED_MEDIA_TYPE,
    CV_UNREADABLE,
    RATE_LIMITED,
    QUOTA_EXCEEDED,
    UNEXPECTED_ERROR,
    AUTH_UNAVAILABLE,
    UNAVAILABLE,
    UNKNOWN,
}

fun String?.toApiErrorCode(): ApiErrorCode =
    ApiErrorCode.entries.firstOrNull { it.name == this } ?: ApiErrorCode.UNKNOWN
