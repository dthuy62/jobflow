package me.dthuy.jobflow.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import java.time.Clock

@Module
@InstallIn(SingletonComponent::class)
object TimeModule {
    /** Wall-clock time in UTC; tests pass their own [Clock]. Formatting to local time happens in the UI. */
    @Provides
    fun provideClock(): Clock = Clock.systemUTC()
}
