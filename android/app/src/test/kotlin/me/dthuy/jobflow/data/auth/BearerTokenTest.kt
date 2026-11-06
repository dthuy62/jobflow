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
    private val authenticator = TokenAuthenticator(tokens, isPublic = { it.isPublicRoute() })
    private val client = OkHttpClient.Builder()
        .addInterceptor(BearerTokenInterceptor(tokens, isPublic = { it.isPublicRoute() }))
        .addInterceptor(server)
        .build()

    @Test
    fun `a protected call carries the access token`() {
        call("api/v1/me")

        assertEquals("Bearer access", server.requests.single().header("Authorization"))
    }

    @Test
    fun `health and the calls that get or refresh a session carry no token`() {
        listOf("api/v1/health", "api/v1/auth/guest", "api/v1/auth/sso", "api/v1/auth/refresh").forEach(::call)

        assertTrue(server.requests.all { it.header("Authorization") == null })
        assertEquals(0, tokens.reads)
    }

    @Test
    fun `logout carries the token, because it ends this session`() {
        call("api/v1/auth/logout")

        assertEquals("Bearer access", server.requests.single().header("Authorization"))
    }

    @Test
    fun `a 401 refreshes the token it was sent with, and retries with the new one`() {
        val retry = authenticator.authenticate(null, unauthorized(bearer = "access"))

        assertEquals("Bearer fresh", retry?.header("Authorization"))
        assertEquals(listOf("access"), tokens.rejected)
    }

    @Test
    fun `a 401 on a call sent without a token comes back to the app`() {
        assertNull(authenticator.authenticate(null, unauthorized(bearer = null)))
        assertTrue(tokens.rejected.isEmpty())
    }

    @Test
    fun `a 401 on a public route is not retried`() {
        assertNull(authenticator.authenticate(null, unauthorized("api/v1/auth/refresh", bearer = null)))
    }

    @Test
    fun `a second 401 gives up`() {
        val second = unauthorized(bearer = "fresh").newBuilder().priorResponse(unauthorized(bearer = "access")).build()

        assertNull(authenticator.authenticate(null, second))
        assertTrue(tokens.rejected.isEmpty())
    }

    @Test
    fun `a session that ended comes back to the app as the 401`() {
        tokens.fresh = null

        assertNull(authenticator.authenticate(null, unauthorized(bearer = "access")))
    }

    @Test
    fun `no session means the call goes out without a token`() {
        tokens.current = null

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

    private fun request(path: String, bearer: String? = null) = Request.Builder()
        .url("http://10.0.2.2:4010/$path")
        .apply { bearer?.let { header("Authorization", "Bearer $it") } }
        .build()

    private fun unauthorized(path: String = "api/v1/me", bearer: String?) = Response.Builder()
        .request(request(path, bearer))
        .protocol(Protocol.HTTP_1_1)
        .code(401)
        .message("x")
        .body("".toResponseBody(null))
        .build()

    private class FakeTokens : AccessTokenSource {
        var current: String? = "access"
        var fresh: String? = "fresh"
        var failure: IOException? = null
        var reads = 0
        val rejected = mutableListOf<String>()

        override fun accessToken(): String? {
            failure?.let { throw it }
            reads++
            return current
        }

        override fun refreshedAccessToken(rejected: String): String? {
            this.rejected += rejected
            return fresh
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
