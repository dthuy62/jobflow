package me.dthuy.jobflow.ui.settings

import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.ui.auth.AuthKind
import me.dthuy.jobflow.ui.auth.AuthUiState
import me.dthuy.jobflow.ui.auth.toUiError
import me.dthuy.jobflow.ui.components.toUiError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AccountUiStateTest {
    private val guest = AuthUiState(AuthKind.GUEST, canSignIn = true)
    private val member = AuthUiState(AuthKind.MEMBER)
    private val signedOut = AuthUiState(AuthKind.SIGNED_OUT, canSignIn = true)

    @Test
    fun `with no check, the card shows what auth says`() {
        val state = accountUiState(member, AccountCheck.Idle)

        assertEquals(AuthKind.MEMBER, state.kind)
        assertTrue(state.canSignOut)
        assertFalse(state.canSignIn || state.canRetry)
    }

    @Test
    fun `a running check offers nothing`() {
        val state = accountUiState(member, AccountCheck.Running)

        assertEquals(AuthKind.LOADING, state.kind)
        assertFalse(state.canSignIn || state.canRetry || state.canSignOut)
    }

    @Test
    fun `an offline check keeps who the user is and offers retry`() {
        val state = accountUiState(member, failed(AppError.Unreachable))

        assertEquals(AuthKind.MEMBER, state.kind)
        assertTrue(state.canRetry)
        assertFalse(state.canSignIn)
        assertTrue(state.canSignOut)
    }

    @Test
    fun `a 401 asks to sign in, not to retry`() {
        val state = accountUiState(member, failed(AppError.Unauthorized))

        assertTrue(state.canSignIn)
        assertFalse(state.canRetry)
    }

    @Test
    fun `a sign-in check that is unavailable offers retry and does not ask to sign in`() {
        val state = accountUiState(member, failed(AppError.Rejected(ApiErrorCode.AUTH_UNAVAILABLE)))

        assertTrue(state.canRetry)
        assertFalse(state.canSignIn)
    }

    @Test
    fun `a failed check says nothing once nobody is signed in`() {
        val state = accountUiState(signedOut, failed(AppError.Unreachable))

        assertNull(state.error)
        assertFalse(state.canRetry)
    }

    @Test
    fun `a running check says nothing once nobody is signed in`() {
        assertEquals(AuthKind.SIGNED_OUT, accountUiState(signedOut, AccountCheck.Running).kind)
    }

    @Test
    fun `while a sign-in runs, a failed check offers nothing`() {
        val state = accountUiState(AuthUiState(), failed(AppError.Unauthorized))

        assertEquals(AuthKind.LOADING, state.kind)
        assertNull(state.error)
        assertFalse(state.canSignIn || state.canRetry)
    }

    @Test
    fun `a failed sign-in shows over a failed check and hides its retry`() {
        val signInError = AuthError.Network.toUiError()
        val auth = guest.copy(error = signInError)

        val state = accountUiState(auth, failed(AppError.Unreachable))

        assertEquals(signInError, state.error)
        assertTrue(state.canSignIn)
        assertFalse(state.canRetry)
    }

    private fun failed(error: AppError) = AccountCheck.Failed(error.toUiError())
}
