package me.dthuy.jobflow.data.auth

import java.io.IOException
import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

/** Blocks, which OkHttp allows: it calls these off the main thread. Null means this user has no valid session. */
fun interface IdTokenSource {
    @Throws(IOException::class)
    fun idToken(forceRefresh: Boolean): String?
}

/** [isPublic] names the requests that need no token, so they never depend on the identity service. */
class BearerTokenInterceptor(private val tokens: IdTokenSource, private val isPublic: (Request) -> Boolean) :
    Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (isPublic(request)) return chain.proceed(request)
        return chain.proceed(request.withBearer(tokens.idToken(forceRefresh = false)))
    }
}

/** A token can expire or be revoked early, so a 401 earns one retry with a fresh token before it reaches the app. */
class TokenAuthenticator(private val tokens: IdTokenSource, private val isPublic: (Request) -> Boolean) :
    Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        if (response.priorResponse != null || isPublic(response.request)) return null
        return tokens.idToken(forceRefresh = true)?.let(response.request::withBearer)
    }
}

private fun Request.withBearer(token: String?): Request =
    if (token == null) this else newBuilder().header("Authorization", "Bearer $token").build()
