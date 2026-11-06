package me.dthuy.jobflow.ui.auth

import me.dthuy.jobflow.core.common.ErrorAction
import me.dthuy.jobflow.domain.auth.AuthError
import org.junit.Assert.assertEquals
import org.junit.Test

class AuthErrorUiTest {
    private val expected = mapOf(
        AuthError.Network to ErrorAction.Retry,
        AuthError.NoGoogleAccount to ErrorAction.None,
        AuthError.GoogleUnavailable to ErrorAction.None,
        AuthError.SignInFailed to ErrorAction.Retry,
        AuthError.TooManyAttempts to ErrorAction.Retry,
        AuthError.AccountDisabled to ErrorAction.None,
        AuthError.GuestAlreadyUsed to ErrorAction.SignIn,
    )

    @Test
    fun `each failure offers what the user can do`() {
        expected.forEach { (error, action) -> assertEquals(error.toString(), action, error.toUiError().action) }
    }

    @Test
    fun `each failure has its own message`() {
        assertEquals(expected.size, expected.keys.map { it.toUiError().message }.toSet().size)
    }
}
