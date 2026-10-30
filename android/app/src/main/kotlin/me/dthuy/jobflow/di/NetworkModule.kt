package me.dthuy.jobflow.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import me.dthuy.jobflow.BuildConfig
import me.dthuy.jobflow.data.remote.ApiJson
import me.dthuy.jobflow.data.remote.CareerOpsApi
import me.dthuy.jobflow.data.remote.PairingTokenInterceptor
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
    fun provideOkHttpClient(): OkHttpClient = OkHttpClient.Builder()
        // Pairing token storage arrives with Epic 7.
        .addInterceptor(PairingTokenInterceptor { null })
        .build()

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient): Retrofit = Retrofit.Builder()
        .baseUrl(normalizeBaseUrl(BuildConfig.CAREER_OPS_DEFAULT_BASE_URL))
        .client(client)
        .addConverterFactory(ApiJson.asConverterFactory("application/json".toMediaType()))
        .build()

    @Provides
    @Singleton
    fun provideCareerOpsApi(retrofit: Retrofit): CareerOpsApi = retrofit.create(CareerOpsApi::class.java)
}
