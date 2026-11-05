package me.dthuy.jobflow.ui.auth

import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.Session
import me.dthuy.jobflow.domain.auth.Uid
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthUiStateTest {
    private val guest = Session.Guest(Uid("uid"))
    private val member = Session.Member(Uid("uid"))

    @Test
    fun `an unknown session offers nothing yet`() {
        val state = authUiState(Session.Unknown, AuthActivity.Idle)

        assertEquals(AuthKind.LOADING, state.kind)
        assertNoButtons(state)
    }

    @Test
    fun `signed out on a new install offers Google or a guest`() {
        val state = authUiState(Session.SignedOut(canStartGuest = true), AuthActivity.Idle)

        assertEquals(AuthKind.SIGNED_OUT, state.kind)
        assertTrue(state.canSignIn)
        assertTrue(state.canContinueAsGuest)
        assertFalse(state.canSignOut)
    }

    @Test
    fun `signed out after this install's guest offers only Google`() {
        val state = authUiState(Session.SignedOut(canStartGuest = false), AuthActivity.Idle)

        assertTrue(state.canSignIn)
        assertFalse(state.canContinueAsGuest)
    }

    @Test
    fun `a guest can sign in, and cannot sign out and lose their identity`() {
        val state = authUiState(guest, AuthActivity.Idle)

        assertEquals(AuthKind.GUEST, state.kind)
        assertTrue(state.canSignIn)
        assertFalse(state.canSignOut)
    }

    @Test
    fun `a member can sign out`() {
        val state = authUiState(member, AuthActivity.Idle)

        assertEquals(AuthKind.MEMBER, state.kind)
        assertFalse(state.canSignIn)
        assertTrue(state.canSignOut)
    }

    @Test
    fun `running offers nothing, so an action cannot start twice`() {
        assertNoButtons(authUiState(Session.SignedOut(canStartGuest = true), AuthActivity.Running))
    }

    @Test
    fun `a failed command keeps who the user is and retries with the same button`() {
        val state = authUiState(guest, AuthActivity.Failed(AuthError.SignInFailed.toUiError()))

        assertEquals(AuthKind.GUEST, state.kind)
        assertNotNull(state.error)
        assertTrue(state.canSignIn)
    }

    @Test
    fun `a failed sign-in of a member can be tried again`() {
        val state = authUiState(member, AuthActivity.Failed(AuthError.Network.toUiError()))

        assertEquals(AuthKind.MEMBER, state.kind)
        assertTrue(state.canSignIn)
    }

    private fun assertNoButtons(state: AuthUiState) {
        assertFalse(state.canSignIn || state.canContinueAsGuest || state.canSignOut)
    }
}
