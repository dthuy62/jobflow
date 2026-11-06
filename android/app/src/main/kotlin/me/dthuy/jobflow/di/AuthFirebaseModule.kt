package me.dthuy.jobflow.di

import com.google.firebase.auth.FirebaseAuth
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import me.dthuy.jobflow.data.auth.IdentityProvider
import me.dthuy.jobflow.data.auth.InstallationIdSource
import me.dthuy.jobflow.data.auth.firebase.FirebaseIdentityProvider
import me.dthuy.jobflow.data.auth.firebase.FirebaseInstallationIdSource

/** The one place that picks the identity vendor. Changing vendor means another implementation and this file. */
@Module
@InstallIn(SingletonComponent::class)
abstract class AuthFirebaseModule {
    @Binds
    abstract fun bindIdentityProvider(impl: FirebaseIdentityProvider): IdentityProvider

    @Binds
    abstract fun bindInstallationIdSource(impl: FirebaseInstallationIdSource): InstallationIdSource

    companion object {
        @Provides
        @Singleton
        fun provideFirebaseAuth(): FirebaseAuth = FirebaseAuth.getInstance()
    }
}
