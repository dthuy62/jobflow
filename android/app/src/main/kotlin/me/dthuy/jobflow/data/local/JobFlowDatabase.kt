package me.dthuy.jobflow.data.local

import androidx.room3.ColumnTypeConverters
import androidx.room3.Database
import androidx.room3.RoomDatabase
import me.dthuy.jobflow.data.local.dao.FeedDao
import me.dthuy.jobflow.data.local.entity.FeedItemEntity
import me.dthuy.jobflow.data.local.entity.JobEntity

/** A cache the API can always rebuild, not a source of truth, so a destructive migration is acceptable. */
@Database(entities = [JobEntity::class, FeedItemEntity::class], version = 1)
@ColumnTypeConverters(StringListConverter::class)
abstract class JobFlowDatabase : RoomDatabase() {
    abstract fun feedDao(): FeedDao
}
