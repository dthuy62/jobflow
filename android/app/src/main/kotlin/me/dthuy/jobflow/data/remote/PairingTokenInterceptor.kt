package me.dthuy.jobflow.data.remote

import okhttp3.Interceptor
import okhttp3.Response

/** Adds the wrapper's pairing header when a token is configured; the token is read per request. */
class PairingTokenInterceptor(private val token: () -> String?) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val value = token()?.trim()
        val request =
            if (value.isNullOrEmpty()) {
                chain.request()
            } else {
                chain.request().newBuilder().header(HEADER, value).build()
            }
        return chain.proceed(request)
    }

    private companion object {
        const val HEADER = "X-Career-Ops-Token"
    }
}
