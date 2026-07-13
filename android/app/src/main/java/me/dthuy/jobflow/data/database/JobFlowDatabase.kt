package me.dthuy.jobflow.data.database

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [TaskEntity::class], version = 1, exportSchema = false)
abstract class JobFlowDatabase : RoomDatabase() {
    abstract fun taskDao(): TaskDao

    companion object {
        @Volatile
        private var databaseInstance: JobFlowDatabase? = null

        fun getDatabase(context: Context): JobFlowDatabase =
            databaseInstance ?: synchronized(this) {
                val instance =
                    Room
                        .databaseBuilder(
                            context.applicationContext,
                            JobFlowDatabase::class.java,
                            "task_arena_database",
                        ).fallbackToDestructiveMigration(dropAllTables = true)
                        .build()
                databaseInstance = instance
                instance
            }
    }
}
