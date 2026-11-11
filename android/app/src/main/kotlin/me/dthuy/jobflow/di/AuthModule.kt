package me.dthuy.jobflow.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.preferencesDataStoreFile
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.Multibinds
import javax.inject.Singleton
import me.dthuy.jobflow.data.auth.AccessTokenSource
import me.dthuy.jobflow.data.auth.AuthApi
import me.dthuy.jobflow.data.auth.AuthStore
import me.dthuy.jobflow.data.auth.AuthenticationServiceImpl
import me.dthuy.jobflow.data.auth.DataStoreGuestLedger
import me.dthuy.jobflow.data.auth.DataStoreSessionStore
import me.dthuy.jobflow.data.auth.GuestLedger
import me.dthuy.jobflow.data.auth.SessionStore
import me.dthuy.jobflow.data.auth.SessionTokens
import me.dthuy.jobflow.domain.auth.AuthenticationService
import me.dthuy.jobflow.domain.auth.SessionObserver
import retrofit2.Retrofit

@Module
@InstallIn(SingletonComponent::class)
abstract class AuthModule {
    @Binds
    abstract fun bindAuthenticationService(impl: AuthenticationServiceImpl): AuthenticationService

    @Binds
    abstract fun bindGuestLedger(impl: DataStoreGuestLedger): GuestLedger

    @Binds
    abstract fun bindSessionStore(impl: DataStoreSessionStore): SessionStore

    @Binds
    abstract fun bindAccessTokenSource(impl: SessionTokens): AccessTokenSource

    /** Declared so the app may register none. */
    @Multibinds
    abstract fun sessionObservers(): Set<SessionObserver>

    companion object {
        @Provides
        @Singleton
        fun provideAuthApi(retrofit: Retrofit): AuthApi = retrofit.create(AuthApi::class.java)

        /** One instance per file, or DataStore throws. A corrupt file starts empty, which signs this device out. */
        @Provides
        @Singleton
        @AuthStore
        fun provideAuthStore(@ApplicationContext context: Context): DataStore<Preferences> =
            PreferenceDataStoreFactory.create(
                corruptionHandler = ReplaceFileCorruptionHandler { emptyPreferences() },
                produceFile = { context.preferencesDataStoreFile("auth") },
            )
    }
}
