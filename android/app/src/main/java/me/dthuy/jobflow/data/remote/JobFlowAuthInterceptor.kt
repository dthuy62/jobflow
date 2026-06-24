package me.dthuy.jobflow.data.remote

import okhttp3.Interceptor
import okhttp3.Response

class JobFlowAuthInterceptor(private val pairingToken: String?) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = pairingToken?.trim()
        val request = if (token.isNullOrEmpty()) {
            chain.request()
        } else {
            chain.request().newBuilder()
                .header("X-Career-Ops-Token", token)
                .build()
        }

        return chain.proceed(request)
    }
}
