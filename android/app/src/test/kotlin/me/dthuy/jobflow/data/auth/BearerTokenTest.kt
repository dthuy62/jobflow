package me.dthuy.jobflow.data.auth

import java.io.IOException
import me.dthuy.jobflow.data.remote.isPublicRoute
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class BearerTokenTest {
    private val tokens = FakeTokens()
    private val server = FakeServer()
    private val client = OkHttpClient.Builder()
        .addInterceptor(BearerTokenInterceptor(tokens, isPublic = { it.isPublicRoute() }))
        .addInterceptor(server)
        .build()

    @Test
    fun `a protected call carries the bearer token`() {
        call("api/v1/me")

        assertEquals("Bearer token-0", server.requests.single().header("Authorization"))
    }

    @Test
    fun `health is public, so it neither carries a token nor signs anyone in`() {
        call("api/v1/health")

        assertNull(server.requests.single().header("Authorization"))
        assertEquals(0, tokens.calls)
    }

    @Test
    fun `a 401 asks for a fresh token and retries with it`() {
        val retry = TokenAuthenticator(tokens).authenticate(null, unauthorized())

        assertEquals("Bearer token-0", retry?.header("Authorization"))
        assertEquals(listOf(true), tokens.forceRefreshes)
    }

    @Test
    fun `a second 401 gives up, so the app can ask the user to sign in`() {
        val second = unauthorized().newBuilder().priorResponse(unauthorized()).build()

        assertNull(TokenAuthenticator(tokens).authenticate(null, second))
        assertEquals(0, tokens.calls)
    }

    @Test
    fun `a 401 with no fresh token to try comes back to the app`() {
        tokens.available = false

        assertNull(TokenAuthenticator(tokens).authenticate(null, unauthorized()))
    }

    @Test
    fun `no token means the call goes out without one`() {
        tokens.available = false

        call("api/v1/me")

        assertNull(server.requests.single().header("Authorization"))
    }

    @Test
    fun `a network failure getting the token fails the call before it is sent`() {
        tokens.failure = IOException("offline")

        assertThrows(IOException::class.java) { call("api/v1/me") }
        assertTrue(server.requests.isEmpty())
    }

    private fun call(path: String): Int = client.newCall(request(path)).execute().use { it.code }

    private fun request(path: String) = Request.Builder().url("http://10.0.2.2:4010/$path").build()

    private fun unauthorized() = Response.Builder()
        .request(request("api/v1/me"))
        .protocol(Protocol.HTTP_1_1)
        .code(401)
        .message("x")
        .body("".toResponseBody(null))
        .build()

    private class FakeTokens : IdTokenSource {
        var available = true
        var failure: IOException? = null
        val forceRefreshes = mutableListOf<Boolean>()
        val calls get() = forceRefreshes.size

        override fun idToken(forceRefresh: Boolean): String? {
            failure?.let { throw it }
            forceRefreshes += forceRefresh
            return if (available) "token-${calls - 1}" else null
        }
    }

    private class FakeServer : Interceptor {
        val requests = mutableListOf<Request>()

        override fun intercept(chain: Interceptor.Chain): Response {
            requests += chain.request()
            return Response.Builder()
                .request(chain.request())
                .protocol(Protocol.HTTP_1_1)
                .code(200)
                .message("x")
                .body("".toResponseBody(null))
                .build()
        }
    }
}
