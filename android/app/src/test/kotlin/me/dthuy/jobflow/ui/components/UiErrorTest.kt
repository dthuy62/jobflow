package me.dthuy.jobflow.ui.components

import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.FeatureError
import org.junit.Assert.assertEquals
import org.junit.Test

class UiErrorTest {
    @Test
    fun `unauthorized asks the user to sign in again`() {
        assertEquals(ErrorAction.SignIn, AppError.Unauthorized.toUiError().action)
    }

    @Test
    fun `a storage failure offers retry`() {
        assertEquals(ErrorAction.Retry, AppError.StorageFailure.toUiError().action)
    }

    @Test
    fun `auth unavailable offers retry and does not ask to sign in`() {
        assertEquals(ErrorAction.Retry, AppError.Rejected(ApiErrorCode.AUTH_UNAVAILABLE).toUiError().action)
    }

    @Test
    fun `transient failures offer retry`() {
        assertEquals(ErrorAction.Retry, AppError.Unreachable.toUiError().action)
        assertEquals(ErrorAction.Retry, AppError.ServerFailure(503).toUiError().action)
    }

    @Test
    fun `every API error code has its own message`() {
        val messages = ApiErrorCode.entries.map { AppError.Rejected(it).toUiError().message }

        assertEquals(ApiErrorCode.entries.size, messages.toSet().size)
    }

    @Test
    fun `every API error code offers the right action`() {
        val expected = mapOf(
            ApiErrorCode.VALIDATION_ERROR to ErrorAction.None,
            ApiErrorCode.UNAUTHORIZED to ErrorAction.SignIn,
            ApiErrorCode.SIGN_IN_REQUIRED to ErrorAction.SignIn,
            ApiErrorCode.ENTITLEMENT_REQUIRED to ErrorAction.None,
            ApiErrorCode.INTEGRITY_FAILED to ErrorAction.None,
            ApiErrorCode.NOT_FOUND to ErrorAction.None,
            ApiErrorCode.CONFLICT to ErrorAction.Retry,
            ApiErrorCode.PAYLOAD_TOO_LARGE to ErrorAction.None,
            ApiErrorCode.UNSUPPORTED_MEDIA_TYPE to ErrorAction.None,
            ApiErrorCode.CV_UNREADABLE to ErrorAction.None,
            ApiErrorCode.RATE_LIMITED to ErrorAction.Retry,
            ApiErrorCode.QUOTA_EXCEEDED to ErrorAction.None,
            ApiErrorCode.UNEXPECTED_ERROR to ErrorAction.Retry,
            ApiErrorCode.AUTH_UNAVAILABLE to ErrorAction.Retry,
            ApiErrorCode.UNAVAILABLE to ErrorAction.Retry,
            ApiErrorCode.UNKNOWN to ErrorAction.Retry,
        )

        assertEquals(expected, ApiErrorCode.entries.associateWith { AppError.Rejected(it).toUiError().action })
    }

    @Test
    fun `an unhandled feature error falls back to the generic message`() {
        val unhandled = object : FeatureError {}

        assertEquals(AppError.Unknown.toUiError(), AppError.Feature(unhandled).toUiError())
    }
}
