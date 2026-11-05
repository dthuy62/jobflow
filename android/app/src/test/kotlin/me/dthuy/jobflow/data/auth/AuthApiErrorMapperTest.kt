package me.dthuy.jobflow.data.auth

import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.SerializationException
import me.dthuy.jobflow.domain.auth.AuthError
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

class AuthApiErrorMapperTest {
    @Test
    fun `no connection says so`() {
        assertEquals(AuthError.Network, AuthApiErrorMapper.map(IOException("offline")))
    }

    @Test
    fun `too many requests says so`() {
        assertEquals(AuthError.TooManyAttempts, AuthApiErrorMapper.map(http(429)))
    }

    @Test
    fun `any other refusal can be retried`() {
        assertEquals(AuthError.SignInFailed, AuthApiErrorMapper.map(http(503)))
        assertEquals(AuthError.SignInFailed, AuthApiErrorMapper.map(http(403)))
        assertEquals(AuthError.SignInFailed, AuthApiErrorMapper.map(SerializationException("x")))
    }

    @Test
    fun `cancellation is rethrown`() {
        assertThrows(CancellationException::class.java) { AuthApiErrorMapper.map(CancellationException()) }
    }

    @Test
    fun `an unexpected exception is rethrown in debug`() {
        assertThrows(IllegalStateException::class.java) { AuthApiErrorMapper.map(IllegalStateException()) }
    }

    private fun http(code: Int) =
        HttpException(Response.error<Unit>(code, "{}".toResponseBody("application/json".toMediaType())))
}
