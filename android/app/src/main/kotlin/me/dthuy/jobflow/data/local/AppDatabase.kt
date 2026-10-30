package me.dthuy.jobflow.data.local

import androidx.room3.Database
import androidx.room3.RoomDatabase
import me.dthuy.jobflow.data.local.dao.ChatMessageDao
import me.dthuy.jobflow.data.local.entity.ChatMessageEntity

@Database(entities = [ChatMessageEntity::class], version = 1, exportSchema = true)
abstract class AppDatabase : RoomDatabase() {
    abstract fun chatMessageDao(): ChatMessageDao
}
