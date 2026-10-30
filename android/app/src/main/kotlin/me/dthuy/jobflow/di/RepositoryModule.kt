package me.dthuy.jobflow.di

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import me.dthuy.jobflow.data.repository.impl.HealthRepositoryImpl
import me.dthuy.jobflow.domain.repository.HealthRepository

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds
    abstract fun bindHealthRepository(impl: HealthRepositoryImpl): HealthRepository
}
