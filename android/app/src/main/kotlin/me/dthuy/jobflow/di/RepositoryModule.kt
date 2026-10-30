package me.dthuy.jobflow.di

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import me.dthuy.jobflow.data.preferences.DataStoreSettingsRepository
import me.dthuy.jobflow.data.repository.impl.HealthRepositoryImpl
import me.dthuy.jobflow.domain.repository.HealthRepository
import me.dthuy.jobflow.domain.repository.SettingsRepository

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds
    @Singleton
    abstract fun bindSettingsRepository(impl: DataStoreSettingsRepository): SettingsRepository

    @Binds
    abstract fun bindHealthRepository(impl: HealthRepositoryImpl): HealthRepository
}
