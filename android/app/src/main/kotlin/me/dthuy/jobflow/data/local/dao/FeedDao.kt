package me.dthuy.jobflow.data.local.dao

import androidx.room3.Dao
import androidx.room3.Insert
import androidx.room3.OnConflictStrategy
import androidx.room3.Query
import androidx.room3.Transaction
import kotlinx.coroutines.flow.Flow
import me.dthuy.jobflow.data.local.entity.FeedItemEntity
import me.dthuy.jobflow.data.local.entity.FeedItemWithJob
import me.dthuy.jobflow.data.local.entity.JobEntity

@Dao
interface FeedDao {
    @Transaction
    @Query("SELECT * FROM feed_item WHERE ownerUserId = :ownerUserId ORDER BY position")
    fun observeFeed(ownerUserId: String): Flow<List<FeedItemWithJob>>

    // shortcut: holds the feed's first page only, add an append when a screen pages through it.
    @Transaction
    suspend fun replaceFeed(ownerUserId: String, items: List<FeedItemEntity>, jobs: List<JobEntity>) {
        deleteItems(ownerUserId)
        insertJobs(jobs)
        insertItems(items)
        deleteUnusedJobs()
    }

    /** Sign-out and in-app account deletion must call this, so a user's feed does not outlive their session. */
    @Transaction
    suspend fun deleteFeed(ownerUserId: String) {
        deleteItems(ownerUserId)
        deleteUnusedJobs()
    }

    /** Must run when the signed-in user changes: an account deleted on the web leaves no sign-out to clean up after. */
    @Transaction
    suspend fun deleteFeedsExcept(currentUserId: String) {
        deleteItemsExcept(currentUserId)
        deleteUnusedJobs()
    }

    /** Lets tests see that unused jobs go; a job detail query replaces it. */
    @Query("SELECT jobId FROM job ORDER BY jobId")
    suspend fun jobIds(): List<String>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertJobs(jobs: List<JobEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItems(items: List<FeedItemEntity>)

    @Query("DELETE FROM feed_item WHERE ownerUserId = :ownerUserId")
    suspend fun deleteItems(ownerUserId: String)

    @Query("DELETE FROM feed_item WHERE ownerUserId != :currentUserId")
    suspend fun deleteItemsExcept(currentUserId: String)

    @Query("DELETE FROM job WHERE jobId NOT IN (SELECT jobId FROM feed_item)")
    suspend fun deleteUnusedJobs()
}
