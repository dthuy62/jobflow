package me.dthuy.jobflow.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
import me.dthuy.jobflow.BuildConfig
import me.dthuy.jobflow.data.auth.AccessTokenSource
import me.dthuy.jobflow.data.auth.BearerTokenInterceptor
import me.dthuy.jobflow.data.auth.TokenAuthenticator
import me.dthuy.jobflow.data.remote.ApiJson
import me.dthuy.jobflow.data.remote.JobFlowApi
import me.dthuy.jobflow.data.remote.isPublicRoute
import me.dthuy.jobflow.data.remote.normalizeBaseUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

private const val CALL_TIMEOUT_SECONDS = 30L

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides
    @Singleton
    fun provideOkHttpClient(tokens: AccessTokenSource): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(BearerTokenInterceptor(tokens, isPublic = Request::isPublicRoute))
        .authenticator(TokenAuthenticator(tokens, isPublic = Request::isPublicRoute))
        .callTimeout(CALL_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .build()

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient): Retrofit = Retrofit.Builder()
        .baseUrl(normalizeBaseUrl(BuildConfig.API_BASE_URL))
        .client(client)
        .addConverterFactory(ApiJson.asConverterFactory("application/json".toMediaType()))
        .build()

    @Provides
    @Singleton
    fun provideJobFlowApi(retrofit: Retrofit): JobFlowApi = retrofit.create(JobFlowApi::class.java)
}
