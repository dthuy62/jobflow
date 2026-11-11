package me.dthuy.jobflow.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.preferencesDataStoreFile
import com.google.firebase.auth.FirebaseAuth
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
import me.dthuy.jobflow.data.auth.DataStoreSessionStore
import me.dthuy.jobflow.data.auth.IdentityProvider
import me.dthuy.jobflow.data.auth.InstallationIdSource
import me.dthuy.jobflow.data.auth.SessionStore
import me.dthuy.jobflow.data.auth.SessionTokens
import me.dthuy.jobflow.data.auth.firebase.FirebaseIdentityProvider
import me.dthuy.jobflow.data.auth.firebase.FirebaseInstallationIdSource
import me.dthuy.jobflow.domain.auth.AuthenticationService
import me.dthuy.jobflow.domain.auth.SessionObserver
import retrofit2.Retrofit

/**
 * Auth's wiring, and the one place that picks the identity vendor: the Firebase bindings below. Changing vendor means
 * another implementation and those bindings.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class AuthModule {
    @Binds
    abstract fun bindAuthenticationService(impl: AuthenticationServiceImpl): AuthenticationService

    @Binds
    abstract fun bindSessionStore(impl: DataStoreSessionStore): SessionStore

    @Binds
    abstract fun bindAccessTokenSource(impl: SessionTokens): AccessTokenSource

    @Binds
    abstract fun bindIdentityProvider(impl: FirebaseIdentityProvider): IdentityProvider

    @Binds
    abstract fun bindInstallationIdSource(impl: FirebaseInstallationIdSource): InstallationIdSource

    /** Declared so the app may register none. */
    @Multibinds
    abstract fun sessionObservers(): Set<SessionObserver>

    companion object {
        @Provides
        @Singleton
        fun provideAuthApi(retrofit: Retrofit): AuthApi = retrofit.create(AuthApi::class.java)

        @Provides
        @Singleton
        fun provideFirebaseAuth(): FirebaseAuth = FirebaseAuth.getInstance()

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
