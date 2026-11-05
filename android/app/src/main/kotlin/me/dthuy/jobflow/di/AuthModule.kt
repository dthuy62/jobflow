package me.dthuy.jobflow.di

import com.google.firebase.auth.FirebaseAuth
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.Multibinds
import javax.inject.Singleton
import me.dthuy.jobflow.data.auth.AuthRepositoryImpl
import me.dthuy.jobflow.data.auth.FirebaseIdentityProvider
import me.dthuy.jobflow.data.auth.GuestLedger
import me.dthuy.jobflow.data.auth.IdTokenSource
import me.dthuy.jobflow.data.auth.IdentityProvider
import me.dthuy.jobflow.data.auth.PreferencesGuestLedger
import me.dthuy.jobflow.domain.auth.AuthRepository
import me.dthuy.jobflow.domain.auth.SessionObserver

@Module
@InstallIn(SingletonComponent::class)
abstract class AuthModule {
    @Binds
    abstract fun bindAuthRepository(impl: AuthRepositoryImpl): AuthRepository

    @Binds
    abstract fun bindIdentityProvider(impl: FirebaseIdentityProvider): IdentityProvider

    @Binds
    abstract fun bindIdTokenSource(impl: FirebaseIdentityProvider): IdTokenSource

    @Binds
    abstract fun bindGuestLedger(impl: PreferencesGuestLedger): GuestLedger

    /** Declared so the app may register none. */
    @Multibinds
    abstract fun sessionObservers(): Set<SessionObserver>

    companion object {
        @Provides
        @Singleton
        fun provideFirebaseAuth(): FirebaseAuth = FirebaseAuth.getInstance()
    }
}
