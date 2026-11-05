package me.dthuy.jobflow.ui.settings

import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.Session
import me.dthuy.jobflow.domain.auth.Uid
import me.dthuy.jobflow.ui.auth.toUiError
import me.dthuy.jobflow.ui.components.toUiError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AccountUiStateTest {
    private val guest = Session.Guest(Uid("uid"))
    private val member = Session.Member(Uid("uid"))

    @Test
    fun `an unknown session offers nothing yet`() {
        val state = accountUiState(Session.Unknown, AccountActivity.Idle)

        assertEquals(AccountKind.LOADING, state.kind)
        assertNoButtons(state)
    }

    @Test
    fun `signed out on a new install offers Google or a guest`() {
        val state = accountUiState(Session.SignedOut(canStartGuest = true), AccountActivity.Idle)

        assertEquals(AccountKind.SIGNED_OUT, state.kind)
        assertTrue(state.canSignIn)
        assertTrue(state.canContinueAsGuest)
        assertFalse(state.canSignOut)
    }

    @Test
    fun `signed out after this install's guest offers only Google`() {
        val state = accountUiState(Session.SignedOut(canStartGuest = false), AccountActivity.Idle)

        assertTrue(state.canSignIn)
        assertFalse(state.canContinueAsGuest)
    }

    @Test
    fun `a guest can sign in, and cannot sign out and lose their identity`() {
        val state = accountUiState(guest, AccountActivity.Idle)

        assertEquals(AccountKind.GUEST, state.kind)
        assertTrue(state.canSignIn)
        assertFalse(state.canSignOut)
    }

    @Test
    fun `a Google account can sign out`() {
        val state = accountUiState(member, AccountActivity.Idle)

        assertEquals(AccountKind.GOOGLE, state.kind)
        assertFalse(state.canSignIn)
        assertTrue(state.canSignOut)
    }

    @Test
    fun `running offers nothing, so an action cannot start twice`() {
        assertNoButtons(accountUiState(Session.SignedOut(canStartGuest = true), AccountActivity.Running))
    }

    @Test
    fun `a failed action keeps who the user is and retries with the same button`() {
        val state = accountUiState(guest, AccountActivity.ActionFailed(AuthError.SignInFailed.toUiError()))

        assertEquals(AccountKind.GUEST, state.kind)
        assertNotNull(state.error)
        assertTrue(state.canSignIn)
        assertFalse(state.canRetry)
    }

    @Test
    fun `a failed sign-in of a member can be tried again`() {
        val state = accountUiState(member, AccountActivity.ActionFailed(AuthError.Network.toUiError()))

        assertEquals(AccountKind.GOOGLE, state.kind)
        assertTrue(state.canSignIn)
    }

    @Test
    fun `an offline account check keeps who the user is and offers retry`() {
        val state = accountUiState(member, AccountActivity.CheckFailed(AppError.Unreachable.toUiError()))

        assertEquals(AccountKind.GOOGLE, state.kind)
        assertTrue(state.canRetry)
        assertFalse(state.canSignIn)
    }

    @Test
    fun `a 401 asks to sign in, not to retry`() {
        val state = accountUiState(member, AccountActivity.CheckFailed(AppError.Unauthorized.toUiError()))

        assertTrue(state.canSignIn)
        assertFalse(state.canRetry)
    }

    @Test
    fun `a sign-in check that is unavailable offers retry and does not ask to sign in`() {
        val unavailable = AppError.Rejected(ApiErrorCode.AUTH_UNAVAILABLE).toUiError()

        val state = accountUiState(member, AccountActivity.CheckFailed(unavailable))

        assertTrue(state.canRetry)
        assertFalse(state.canSignIn)
    }

    private fun assertNoButtons(state: AccountUiState) {
        assertFalse(state.canSignIn || state.canContinueAsGuest || state.canSignOut || state.canRetry)
    }
}
