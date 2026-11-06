package me.dthuy.jobflow.data.auth

import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

private const val BEARER = "Bearer "

/** [isPublic] names the requests that need no token, including the ones that get or refresh it. */
class BearerTokenInterceptor(private val tokens: AccessTokenSource, private val isPublic: (Request) -> Boolean) :
    Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (isPublic(request)) return chain.proceed(request)
        return chain.proceed(request.withBearer(tokens.accessToken()))
    }
}

/** A 401 earns one retry with a refreshed token before it reaches the app. */
class TokenAuthenticator(private val tokens: AccessTokenSource, private val isPublic: (Request) -> Boolean) :
    Authenticator {
    override fun authenticate(route: Route?, response: Response): Request? {
        if (response.priorResponse != null || isPublic(response.request)) return null
        // A call sent without a token had no session to refresh.
        val rejected = response.request.header("Authorization")?.removePrefix(BEARER)
        return rejected?.let(tokens::refreshedAccessToken)?.let(response.request::withBearer)
    }
}

private fun Request.withBearer(token: String?): Request =
    if (token == null) this else newBuilder().header("Authorization", "$BEARER$token").build()
