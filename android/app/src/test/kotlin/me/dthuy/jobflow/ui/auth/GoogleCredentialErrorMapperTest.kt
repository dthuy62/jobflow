package me.dthuy.jobflow.ui.auth

import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialInterruptedException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnknownException
import androidx.credentials.exceptions.GetCredentialUnsupportedException
import androidx.credentials.exceptions.NoCredentialException
import kotlinx.coroutines.CancellationException
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.domain.auth.AuthError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class GoogleCredentialErrorMapperTest {
    private val mapper = GoogleCredentialErrorMapper

    @Test
    fun `closing the Google sheet is no token and no error`() {
        assertEquals(Either.Right(null), mapper.map(GetCredentialCancellationException()))
    }

    @Test
    fun `no Google account on the device says so`() {
        assertEquals(Either.Left(AuthError.NoGoogleAccount), mapper.map(NoCredentialException()))
    }

    @Test
    fun `a device or build that cannot run Google sign-in says so`() {
        val unavailable = Either.Left(AuthError.GoogleUnavailable)

        assertEquals(unavailable, mapper.map(GetCredentialProviderConfigurationException()))
        assertEquals(unavailable, mapper.map(GetCredentialUnsupportedException()))
    }

    @Test
    fun `other credential failures can be retried`() {
        val failed = Either.Left(AuthError.SignInFailed)

        assertEquals(failed, mapper.map(GetCredentialInterruptedException()))
        assertEquals(failed, mapper.map(GetCredentialUnknownException()))
    }

    @Test
    fun `an unexpected exception is rethrown in debug`() {
        assertThrows(IllegalStateException::class.java) { mapper.map(IllegalStateException()) }
    }

    @Test
    fun `cancellation is rethrown`() {
        assertThrows(CancellationException::class.java) { mapper.map(CancellationException()) }
    }
}
