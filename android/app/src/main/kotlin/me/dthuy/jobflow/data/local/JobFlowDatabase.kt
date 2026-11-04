package me.dthuy.jobflow.data.local

import androidx.room3.Database
import androidx.room3.RoomDatabase

/** A cache the API can always rebuild, not a source of truth, so a destructive migration is acceptable. */
@Database(entities = [CachedResponseEntity::class], version = 1)
abstract class JobFlowDatabase : RoomDatabase() {
    abstract fun responseCache(): ResponseCacheDao
}
