package me.dthuy.jobflow.di

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import me.dthuy.jobflow.data.engine.EchoChatEngine
import me.dthuy.jobflow.data.preferences.DataStoreSettingsRepository
import me.dthuy.jobflow.data.repository.impl.ChatRepositoryImpl
import me.dthuy.jobflow.domain.engine.ChatEngine
import me.dthuy.jobflow.domain.repository.ChatRepository
import me.dthuy.jobflow.domain.repository.SettingsRepository

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds
    @Singleton
    abstract fun bindChatRepository(impl: ChatRepositoryImpl): ChatRepository

    @Binds
    abstract fun bindChatEngine(impl: EchoChatEngine): ChatEngine

    @Binds
    @Singleton
    abstract fun bindSettingsRepository(impl: DataStoreSettingsRepository): SettingsRepository
}
