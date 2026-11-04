package me.dthuy.jobflow.data.local

import androidx.room3.Dao
import androidx.room3.Insert
import androidx.room3.OnConflictStrategy
import androidx.room3.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface ResponseCacheDao {
    @Query("SELECT * FROM cached_response WHERE ownerUserId = :ownerUserId AND `key` = :key")
    fun observe(ownerUserId: String, key: String): Flow<CachedResponseEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun put(response: CachedResponseEntity)

    /** Sign-out and in-app account deletion must call this, so a user's copy does not outlive their session. */
    @Query("DELETE FROM cached_response WHERE ownerUserId = :ownerUserId")
    suspend fun deleteForUser(ownerUserId: String)

    /** Must run when the signed-in user changes: an account deleted on the web leaves no sign-out to clean up after. */
    @Query("DELETE FROM cached_response WHERE ownerUserId != :currentUserId")
    suspend fun deleteOtherUsers(currentUserId: String)
}
