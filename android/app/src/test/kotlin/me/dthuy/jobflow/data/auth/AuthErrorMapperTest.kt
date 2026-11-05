package me.dthuy.jobflow.data.auth

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

class AuthErrorMapperTest {
    @Test
    fun `a network failure says so`() {
        assertEquals(AuthError.Network, AuthErrorMapper.fromFirebase(FirebaseNetworkException("x")))
    }

    @Test
    fun `an account that no longer exists ends the session`() {
        assertEquals(
            AuthError.SessionEnded,
            AuthErrorMapper.fromFirebase(FirebaseAuthInvalidUserException("ERROR_USER_NOT_FOUND", "x")),
        )
    }

    @Test
    fun `a disabled account does not ask for a sign-in that would fail again`() {
        assertEquals(
            AuthError.AccountDisabled,
            AuthErrorMapper.fromFirebase(FirebaseAuthInvalidUserException("ERROR_USER_DISABLED", "x")),
        )
    }

    @Test
    fun `a Google token Firebase rejects can be retried, since no session has ended`() {
        assertEquals(
            AuthError.SignInFailed,
            AuthErrorMapper.fromFirebase(FirebaseAuthInvalidCredentialsException("code", "x")),
        )
    }

    @Test
    fun `too many attempts says so`() {
        assertEquals(AuthError.TooManyAttempts, AuthErrorMapper.fromFirebase(FirebaseTooManyRequestsException("x")))
    }

    @Test
    fun `any other Firebase failure can be retried, and keeps the session`() {
        assertEquals(AuthError.SignInFailed, AuthErrorMapper.fromFirebase(FirebaseAuthException("code", "x")))
        assertEquals(AuthError.SignInFailed, AuthErrorMapper.fromFirebase(FirebaseException("x")))
    }

    @Test
    fun `cancellation is rethrown`() {
        assertThrows(CancellationException::class.java) { AuthErrorMapper.fromFirebase(CancellationException()) }
    }

    @Test
    fun `an unexpected exception is rethrown in debug`() {
        assertThrows(IllegalStateException::class.java) { AuthErrorMapper.fromFirebase(IllegalStateException()) }
    }
}
