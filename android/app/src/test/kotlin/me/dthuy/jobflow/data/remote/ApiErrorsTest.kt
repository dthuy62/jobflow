package me.dthuy.jobflow.data.remote

import java.io.IOException
import java.time.Instant
import java.time.format.DateTimeParseException
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.SerializationException
import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.testing.contractFixture
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

class ApiErrorsTest {
    @Test
    fun `io exception maps to Unreachable`() {
        assertEquals(AppError.Unreachable, IOException().toApiError())
    }

    @Test
    fun `http 401 maps to Unauthorized`() {
        assertEquals(AppError.Unauthorized, httpError(401, errorBody("UNAUTHORIZED")).toApiError())
    }

    @Test
    fun `http 401 means sign in again, whatever its body says`() {
        assertEquals(AppError.Unauthorized, httpError(401, "oops").toApiError())
    }

    @Test
    fun `http 4xx carries the API error code`() {
        assertEquals(
            AppError.Rejected(ApiErrorCode.CONFLICT),
            httpError(409, errorBody("CONFLICT")).toApiError(),
        )
        assertEquals(
            AppError.Rejected(ApiErrorCode.SIGN_IN_REQUIRED),
            httpError(403, contractFixture("errors/sign-in-required.json")).toApiError(),
        )
    }

    @Test
    fun `http 4xx with an unparseable body is rejected with UNKNOWN`() {
        assertEquals(AppError.Rejected(ApiErrorCode.UNKNOWN), httpError(400, "oops").toApiError())
    }

    @Test
    fun `unknown API code maps to the UNKNOWN entry`() {
        assertEquals(AppError.Rejected(ApiErrorCode.UNKNOWN), httpError(422, errorBody("FUTURE_CODE")).toApiError())
    }

    @Test
    fun `http 5xx without an API code maps to ServerFailure`() {
        assertEquals(AppError.ServerFailure(503), httpError(503, "oops").toApiError())
    }

    @Test
    fun `http 5xx with an API code is rejected with that code`() {
        assertEquals(
            AppError.Rejected(ApiErrorCode.AUTH_UNAVAILABLE),
            httpError(503, contractFixture("errors/auth-unavailable.json")).toApiError(),
        )
    }

    @Test
    fun `a timestamp the contract did not promise maps to InvalidResponse`() {
        val malformed = assertThrows(DateTimeParseException::class.java) { Instant.parse("yesterday") }

        assertEquals(AppError.InvalidResponse, malformed.toApiError())
    }

    @Test
    fun `serialization exception maps to InvalidResponse`() {
        assertEquals(AppError.InvalidResponse, SerializationException("bad json").toApiError())
    }

    @Test
    fun `cancellation is rethrown`() {
        assertThrows(CancellationException::class.java) { CancellationException().toApiError() }
    }

    @Test
    fun `unexpected exception is rethrown in debug`() {
        assertThrows(IllegalStateException::class.java) { IllegalStateException().toApiError() }
    }

    private fun errorBody(code: String) = """{"error":{"code":"$code","message":"x"}}"""

    private fun httpError(status: Int, body: String) =
        HttpException(Response.error<Any>(status, body.toResponseBody("application/json".toMediaType())))
}
