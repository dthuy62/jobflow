package me.dthuy.jobflow.ui.components

import androidx.annotation.StringRes
import me.dthuy.jobflow.R
import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.core.common.AppError
import timber.log.Timber

/** What the UI shows for an error: a message resource and the one action the user can take. */
data class UiError(@param:StringRes val message: Int, val action: ErrorAction)

enum class ErrorAction { Retry, SignIn, None }

/**
 * The app-wide mapping from [AppError] to what the user sees. Exhaustive on purpose: a new [AppError] case does
 * not compile until it has a message. Features map their own [AppError.Feature] reasons in their screens and fall
 * back to this for everything else.
 */
fun AppError.toUiError(): UiError = when (this) {
    AppError.Unreachable -> UiError(R.string.error_unreachable, ErrorAction.Retry)
    AppError.Unauthorized -> UiError(R.string.error_sign_in_required, ErrorAction.SignIn)
    is AppError.Rejected -> code.toUiError()
    is AppError.ServerFailure -> UiError(R.string.error_server, ErrorAction.Retry)
    AppError.InvalidResponse -> UiError(R.string.error_incompatible, ErrorAction.None)
    AppError.StorageFailure -> UiError(R.string.error_storage, ErrorAction.Retry)
    AppError.Unknown -> UiError(R.string.error_unexpected, ErrorAction.Retry)
    is AppError.Feature -> {
        Timber.w("Unhandled feature error %s; showing the generic message", reason::class.simpleName)
        AppError.Unknown.toUiError()
    }
}

// One flat line per code, exhaustive on purpose: the count is the contract's size, not branching logic.
@Suppress("CyclomaticComplexMethod")
private fun ApiErrorCode.toUiError(): UiError = when (this) {
    ApiErrorCode.VALIDATION_ERROR -> UiError(R.string.error_code_validation_error, ErrorAction.None)
    ApiErrorCode.UNAUTHORIZED -> UiError(R.string.error_code_unauthorized, ErrorAction.SignIn)
    ApiErrorCode.SIGN_IN_REQUIRED -> UiError(R.string.error_code_sign_in_required, ErrorAction.SignIn)
    ApiErrorCode.ENTITLEMENT_REQUIRED -> UiError(R.string.error_code_entitlement_required, ErrorAction.None)
    ApiErrorCode.INTEGRITY_FAILED -> UiError(R.string.error_code_integrity_failed, ErrorAction.None)
    ApiErrorCode.NOT_FOUND -> UiError(R.string.error_code_not_found, ErrorAction.None)
    ApiErrorCode.CONFLICT -> UiError(R.string.error_code_conflict, ErrorAction.Retry)
    ApiErrorCode.PAYLOAD_TOO_LARGE -> UiError(R.string.error_code_payload_too_large, ErrorAction.None)
    ApiErrorCode.UNSUPPORTED_MEDIA_TYPE -> UiError(R.string.error_code_unsupported_media_type, ErrorAction.None)
    ApiErrorCode.CV_UNREADABLE -> UiError(R.string.error_code_cv_unreadable, ErrorAction.None)
    ApiErrorCode.RATE_LIMITED -> UiError(R.string.error_code_rate_limited, ErrorAction.Retry)
    ApiErrorCode.QUOTA_EXCEEDED -> UiError(R.string.error_code_quota_exceeded, ErrorAction.None)
    ApiErrorCode.UNEXPECTED_ERROR -> UiError(R.string.error_code_unexpected_error, ErrorAction.Retry)
    // Sign-in could not be checked: not the user's fault, and they stay signed in.
    ApiErrorCode.AUTH_UNAVAILABLE -> UiError(R.string.error_code_auth_unavailable, ErrorAction.Retry)
    ApiErrorCode.UNAVAILABLE -> UiError(R.string.error_code_unavailable, ErrorAction.Retry)
    ApiErrorCode.UNKNOWN -> UiError(R.string.error_code_unknown, ErrorAction.Retry)
}
