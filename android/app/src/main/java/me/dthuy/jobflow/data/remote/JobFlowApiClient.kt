package me.dthuy.jobflow.data.remote

import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

object JobFlowApiClient {
    private val json =
        Json {
            ignoreUnknownKeys = true
        }

    fun create(
        baseUrl: String,
        pairingToken: String?,
    ): JobFlowApiService {
        val okHttp =
            OkHttpClient.Builder().addInterceptor(JobFlowAuthInterceptor(pairingToken)).build()

        return Retrofit
            .Builder()
            .baseUrl(normalizeBaseUrl(baseUrl))
            .client(okHttp)
            .addConverterFactory(
                json.asConverterFactory("application/json".toMediaType()),
            ).build()
            .create(JobFlowApiService::class.java)
    }

    private fun normalizeBaseUrl(baseUrl: String): String {
        val trimmedBaseUrl = baseUrl.trim()
        require(trimmedBaseUrl.isNotEmpty()) { "Wrapper base URL must not be blank." }

        return if (trimmedBaseUrl.endsWith("/")) trimmedBaseUrl else "$trimmedBaseUrl/"
    }
}
