package me.dthuy.jobflow.ui.components

import androidx.annotation.StringRes
import me.dthuy.jobflow.R
import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.core.common.AppError
import timber.log.Timber

/** What the UI shows for an error: a message resource and the one action the user can take. */
data class UiError(@param:StringRes val message: Int, val action: ErrorAction)

enum class ErrorAction { Retry, Repair, None }

/**
 * The app-wide mapping from [AppError] to what the user sees. Exhaustive on purpose: a new [AppError] case does
 * not compile until it has a message. Features map their own [AppError.Feature] reasons in their screens and fall
 * back to this for everything else.
 */
fun AppError.toUiError(): UiError = when (this) {
    AppError.Unreachable -> UiError(R.string.error_unreachable, ErrorAction.Retry)
    AppError.Unauthorized -> UiError(R.string.error_pairing_required, ErrorAction.Repair)
    is AppError.Rejected -> code.toUiError()
    is AppError.ServerFailure -> UiError(R.string.error_server, ErrorAction.Retry)
    AppError.InvalidResponse -> UiError(R.string.error_incompatible, ErrorAction.None)
    AppError.Unknown -> UiError(R.string.error_unexpected, ErrorAction.Retry)
    is AppError.Feature -> {
        Timber.w("Unhandled feature error %s; showing the generic message", reason::class.simpleName)
        AppError.Unknown.toUiError()
    }
}

private fun ApiErrorCode.toUiError(): UiError = when (this) {
    ApiErrorCode.VALIDATION_ERROR -> UiError(R.string.error_code_validation_error, ErrorAction.None)
    ApiErrorCode.UNAUTHORIZED -> UiError(R.string.error_code_unauthorized, ErrorAction.Repair)
    ApiErrorCode.WORKSPACE_UNHEALTHY -> UiError(R.string.error_code_workspace_unhealthy, ErrorAction.Retry)
    ApiErrorCode.NOT_FOUND -> UiError(R.string.error_code_not_found, ErrorAction.None)
    ApiErrorCode.SCAN_ALREADY_RUNNING -> UiError(R.string.error_code_scan_already_running, ErrorAction.None)
    ApiErrorCode.COMMAND_FAILED -> UiError(R.string.error_code_command_failed, ErrorAction.Retry)
    ApiErrorCode.PARSER_FAILED -> UiError(R.string.error_code_parser_failed, ErrorAction.None)
    ApiErrorCode.PATH_OUTSIDE_WORKSPACE -> UiError(R.string.error_code_path_outside_workspace, ErrorAction.None)
    ApiErrorCode.PAYLOAD_TOO_LARGE -> UiError(R.string.error_code_payload_too_large, ErrorAction.None)
    ApiErrorCode.UNEXPECTED_ERROR -> UiError(R.string.error_code_unexpected_error, ErrorAction.Retry)
    ApiErrorCode.UNKNOWN -> UiError(R.string.error_code_unknown, ErrorAction.Retry)
}
