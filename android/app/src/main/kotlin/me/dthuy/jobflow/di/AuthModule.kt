package me.dthuy.jobflow.di

import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.Multibinds
import javax.inject.Singleton
import me.dthuy.jobflow.data.auth.AuthApi
import me.dthuy.jobflow.data.auth.AuthenticationServiceImpl
import me.dthuy.jobflow.data.auth.GuestLedger
import me.dthuy.jobflow.data.auth.PendingLogin
import me.dthuy.jobflow.data.auth.PreferencesGuestLedger
import me.dthuy.jobflow.data.auth.PreferencesPendingLogin
import me.dthuy.jobflow.domain.auth.AuthenticationService
import me.dthuy.jobflow.domain.auth.SessionObserver
import retrofit2.Retrofit

@Module
@InstallIn(SingletonComponent::class)
abstract class AuthModule {
    @Binds
    abstract fun bindAuthenticationService(impl: AuthenticationServiceImpl): AuthenticationService

    @Binds
    abstract fun bindGuestLedger(impl: PreferencesGuestLedger): GuestLedger

    @Binds
    abstract fun bindPendingLogin(impl: PreferencesPendingLogin): PendingLogin

    /** Declared so the app may register none. */
    @Multibinds
    abstract fun sessionObservers(): Set<SessionObserver>

    companion object {
        @Provides
        @Singleton
        fun provideAuthApi(retrofit: Retrofit): AuthApi = retrofit.create(AuthApi::class.java)
    }
}
