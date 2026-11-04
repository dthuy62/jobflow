package me.dthuy.jobflow.di

import android.content.Context
import androidx.room3.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton
import me.dthuy.jobflow.data.local.JobFlowDatabase
import me.dthuy.jobflow.data.local.dao.FeedDao

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): JobFlowDatabase =
        Room.databaseBuilder<JobFlowDatabase>(context, "jobflow.db")
            .fallbackToDestructiveMigration(dropAllTables = true)
            .build()

    @Provides
    fun provideFeedDao(database: JobFlowDatabase): FeedDao = database.feedDao()
}
