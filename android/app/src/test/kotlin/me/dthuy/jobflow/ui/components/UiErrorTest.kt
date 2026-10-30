package me.dthuy.jobflow.ui.components

import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.FeatureError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class UiErrorTest {
    @Test
    fun `unauthorized asks the user to pair again`() {
        assertEquals(ErrorAction.Repair, AppError.Unauthorized.toUiError().action)
    }

    @Test
    fun `transient failures offer retry`() {
        assertEquals(ErrorAction.Retry, AppError.Unreachable.toUiError().action)
        assertEquals(ErrorAction.Retry, AppError.ServerFailure(503).toUiError().action)
    }

    @Test
    fun `every wrapper error code has its own message`() {
        val messages = ApiErrorCode.entries.map { AppError.Rejected(it).toUiError().message }

        messages.forEach { assertNotEquals(0, it) }
        assertEquals(ApiErrorCode.entries.size, messages.toSet().size)
    }

    @Test
    fun `an unhandled feature error falls back to the generic message`() {
        val unhandled = object : FeatureError {}

        assertEquals(AppError.Unknown.toUiError(), AppError.Feature(unhandled).toUiError())
    }
}
