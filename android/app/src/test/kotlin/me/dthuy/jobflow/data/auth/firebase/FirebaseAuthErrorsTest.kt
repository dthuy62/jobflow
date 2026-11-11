package me.dthuy.jobflow.data.auth.firebase

import com.google.firebase.FirebaseException
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.FirebaseTooManyRequestsException
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.FirebaseAuthInvalidCredentialsException
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import kotlinx.coroutines.CancellationException
import me.dthuy.jobflow.domain.auth.AuthError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class FirebaseAuthErrorsTest {
    @Test
    fun `a network failure says so`() {
        assertEquals(AuthError.Network, FirebaseNetworkException("x").toAuthError())
    }

    @Test
    fun `a Google account Firebase no longer knows can be retried`() {
        assertEquals(
            AuthError.SignInFailed,
            FirebaseAuthInvalidUserException("ERROR_USER_NOT_FOUND", "x").toAuthError(),
        )
    }

    @Test
    fun `a disabled account does not ask for a sign-in that would fail again`() {
        assertEquals(
            AuthError.AccountDisabled,
            FirebaseAuthInvalidUserException("ERROR_USER_DISABLED", "x").toAuthError(),
        )
    }

    @Test
    fun `a Google token Firebase rejects can be retried, since no session has ended`() {
        assertEquals(
            AuthError.SignInFailed,
            FirebaseAuthInvalidCredentialsException("code", "x").toAuthError(),
        )
    }

    @Test
    fun `too many attempts says so`() {
        assertEquals(AuthError.TooManyAttempts, FirebaseTooManyRequestsException("x").toAuthError())
    }

    @Test
    fun `any other Firebase failure can be retried, and keeps the session`() {
        assertEquals(AuthError.SignInFailed, FirebaseAuthException("code", "x").toAuthError())
        assertEquals(AuthError.SignInFailed, FirebaseException("x").toAuthError())
    }

    @Test
    fun `cancellation is rethrown`() {
        assertThrows(CancellationException::class.java) { CancellationException().toAuthError() }
    }

    @Test
    fun `an unexpected exception is rethrown in debug`() {
        assertThrows(IllegalStateException::class.java) { IllegalStateException().toAuthError() }
    }
}
