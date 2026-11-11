package me.dthuy.jobflow.core.network

import java.io.IOException
import java.time.Instant
import java.time.format.DateTimeParseException
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.SerializationException
import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.core.common.DataSourceError
import me.dthuy.jobflow.testing.contractFixture
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

class RemoteErrorsTest {
    @Test
    fun `io exception maps to Unreachable`() {
        assertEquals(DataSourceError.Remote.Unreachable, IOException().toRemoteError())
    }

    @Test
    fun `http 401 maps to Unauthorized`() {
        assertEquals(DataSourceError.Remote.Unauthorized, httpError(401, errorBody("UNAUTHORIZED")).toRemoteError())
    }

    @Test
    fun `http 401 means sign in again, whatever its body says`() {
        assertEquals(DataSourceError.Remote.Unauthorized, httpError(401, "oops").toRemoteError())
    }

    @Test
    fun `http 4xx carries the API error code`() {
        assertEquals(
            DataSourceError.Remote.Rejected(ApiErrorCode.CONFLICT),
            httpError(409, errorBody("CONFLICT")).toRemoteError(),
        )
        assertEquals(
            DataSourceError.Remote.Rejected(ApiErrorCode.SIGN_IN_REQUIRED),
            httpError(403, contractFixture("errors/sign-in-required.json")).toRemoteError(),
        )
    }

    @Test
    fun `http 4xx with an unparseable body is rejected with UNKNOWN`() {
        assertEquals(DataSourceError.Remote.Rejected(ApiErrorCode.UNKNOWN), httpError(400, "oops").toRemoteError())
    }

    @Test
    fun `a 429 from in front of the API still means rate limited`() {
        assertEquals(
            DataSourceError.Remote.Rejected(ApiErrorCode.RATE_LIMITED),
            httpError(429, "Rate exceeded").toRemoteError(),
        )
    }

    @Test
    fun `a 429 with the API's own code keeps that code`() {
        assertEquals(
            DataSourceError.Remote.Rejected(ApiErrorCode.QUOTA_EXCEEDED),
            httpError(429, contractFixture("errors/quota-exceeded.json")).toRemoteError(),
        )
    }

    @Test
    fun `unknown API code maps to the UNKNOWN entry`() {
        assertEquals(
            DataSourceError.Remote.Rejected(ApiErrorCode.UNKNOWN),
            httpError(422, errorBody("FUTURE_CODE")).toRemoteError(),
        )
    }

    @Test
    fun `http 5xx without an API code maps to ServerFailure`() {
        assertEquals(DataSourceError.Remote.ServerFailure(503), httpError(503, "oops").toRemoteError())
    }

    @Test
    fun `http 5xx with an API code is rejected with that code`() {
        assertEquals(
            DataSourceError.Remote.Rejected(ApiErrorCode.AUTH_UNAVAILABLE),
            httpError(503, contractFixture("errors/auth-unavailable.json")).toRemoteError(),
        )
    }

    @Test
    fun `a timestamp the contract did not promise maps to InvalidResponse`() {
        val malformed = assertThrows(DateTimeParseException::class.java) { Instant.parse("yesterday") }

        assertEquals(DataSourceError.Remote.InvalidResponse, malformed.toRemoteError())
    }

    @Test
    fun `serialization exception maps to InvalidResponse`() {
        assertEquals(DataSourceError.Remote.InvalidResponse, SerializationException("bad json").toRemoteError())
    }

    @Test
    fun `cancellation is rethrown`() {
        assertThrows(CancellationException::class.java) { CancellationException().toRemoteError() }
    }

    @Test
    fun `unexpected exception is rethrown in debug`() {
        assertThrows(IllegalStateException::class.java) { IllegalStateException().toRemoteError() }
    }

    private fun errorBody(code: String) = """{"error":{"code":"$code","message":"x"}}"""

    private fun httpError(status: Int, body: String) =
        HttpException(Response.error<Any>(status, body.toResponseBody("application/json".toMediaType())))
}
