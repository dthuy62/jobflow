package me.dthuy.jobflow.data.remote

import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

object JobFlowApiClient {
    fun create(baseUrl: String, pairingToken: String?): JobFlowApiService {
        val okHttp =
            OkHttpClient.Builder().addInterceptor(JobFlowAuthInterceptor(pairingToken)).build()

        return Retrofit.Builder().baseUrl(normalizeBaseUrl(baseUrl)).client(okHttp)
            .addConverterFactory(
                MoshiConverterFactory.create()
            ).build().create(JobFlowApiService::class.java)
    }

    private fun normalizeBaseUrl(baseUrl: String): String {
        val trimmedBaseUrl = baseUrl.trim()
        require(trimmedBaseUrl.isNotEmpty()) { "Wrapper base URL must not be blank." }

        return if (trimmedBaseUrl.endsWith("/")) trimmedBaseUrl else "$trimmedBaseUrl/"
    }
}
