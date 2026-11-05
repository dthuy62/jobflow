package me.dthuy.jobflow.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import me.dthuy.jobflow.BuildConfig
import me.dthuy.jobflow.data.auth.BearerTokenInterceptor
import me.dthuy.jobflow.data.auth.IdTokenSource
import me.dthuy.jobflow.data.auth.TokenAuthenticator
import me.dthuy.jobflow.data.remote.ApiJson
import me.dthuy.jobflow.data.remote.JobFlowApi
import me.dthuy.jobflow.data.remote.isPublicRoute
import me.dthuy.jobflow.data.remote.normalizeBaseUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides
    @Singleton
    fun provideOkHttpClient(tokens: IdTokenSource): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(BearerTokenInterceptor(tokens, isPublic = { it.isPublicRoute() }))
        .authenticator(TokenAuthenticator(tokens))
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
