package me.dthuy.jobflow.di

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import me.dthuy.jobflow.data.local.FeedSessionCleanup
import me.dthuy.jobflow.data.repository.impl.AccountRepositoryImpl
import me.dthuy.jobflow.data.repository.impl.HealthRepositoryImpl
import me.dthuy.jobflow.domain.auth.SessionObserver
import me.dthuy.jobflow.domain.repository.AccountRepository
import me.dthuy.jobflow.domain.repository.HealthRepository

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds
    abstract fun bindHealthRepository(impl: HealthRepositoryImpl): HealthRepository

    @Binds
    abstract fun bindAccountRepository(impl: AccountRepositoryImpl): AccountRepository

    @Binds
    @IntoSet
    abstract fun bindFeedSessionCleanup(impl: FeedSessionCleanup): SessionObserver
}
