package me.dthuy.jobflow.ui.auth

import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.Session
import me.dthuy.jobflow.domain.auth.Uid
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthStateTest {
    private val guest = Session.Guest(Uid("uid"))
    private val member = Session.Member(Uid("uid"))
    private val failure = AuthError.Network.toUiError()

    @Test
    fun `an unknown session offers nothing yet`() {
        assertEquals(AuthState(), authState(Session.Unknown, running = false, error = null))
    }

    @Test
    fun `running offers nothing, so a command cannot start twice`() {
        assertEquals(AuthState(), authState(Session.SignedOut(canStartGuest = true), running = true, error = failure))
    }

    @Test
    fun `signed out on a new install offers Google or a guest`() {
        val state = authState(Session.SignedOut(canStartGuest = true), running = false, error = null)

        assertEquals(AuthKind.SIGNED_OUT, state.kind)
        assertTrue(state.canSignIn && state.canContinueAsGuest)
        assertFalse(state.canSignOut)
    }

    @Test
    fun `signed out after this install's guest offers only Google`() {
        val state = authState(Session.SignedOut(canStartGuest = false), running = false, error = null)

        assertTrue(state.canSignIn)
        assertFalse(state.canContinueAsGuest)
    }

    @Test
    fun `a guest can sign in, and cannot sign out and lose their identity`() {
        val state = authState(guest, running = false, error = null)

        assertEquals(AuthKind.GUEST, state.kind)
        assertTrue(state.canSignIn)
        assertFalse(state.canSignOut)
    }

    @Test
    fun `a member can sign out`() {
        val state = authState(member, running = false, error = null)

        assertEquals(AuthKind.MEMBER, state.kind)
        assertFalse(state.canSignIn)
        assertTrue(state.canSignOut)
        assertNull(state.error)
    }

    @Test
    fun `a member's failed sign-in can be tried again`() {
        val state = authState(member, running = false, error = failure)

        assertEquals(failure, state.error)
        assertTrue(state.canSignIn)
    }
}
