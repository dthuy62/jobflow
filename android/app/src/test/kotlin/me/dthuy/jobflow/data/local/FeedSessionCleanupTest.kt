package me.dthuy.jobflow.data.local

import android.database.SQLException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.test.runTest
import me.dthuy.jobflow.data.local.dao.FeedDao
import me.dthuy.jobflow.data.local.entity.FeedItemEntity
import me.dthuy.jobflow.data.local.entity.FeedItemWithJob
import me.dthuy.jobflow.data.local.entity.JobEntity
import me.dthuy.jobflow.domain.auth.Uid
import org.junit.Assert.assertEquals
import org.junit.Test

class FeedSessionCleanupTest {
    private val dao = FakeFeedDao()
    private val cleanup = FeedSessionCleanup(dao)

    @Test
    fun `a signed-in user keeps only their own feed`() = runTest {
        cleanup.onUserChanged(Uid("uid_a"))

        assertEquals(listOf("except uid_a"), dao.cleanups)
    }

    @Test
    fun `no user means no feed stays`() = runTest {
        cleanup.onUserChanged(null)

        assertEquals(listOf("all"), dao.cleanups)
    }

    @Test
    fun `a database failure is not fatal, because reads filter by owner`() = runTest {
        dao.failure = SQLException("disk full")

        cleanup.onUserChanged(null)

        assertEquals(emptyList<String>(), dao.cleanups)
    }

    private class FakeFeedDao : FeedDao {
        val cleanups = mutableListOf<String>()
        var failure: Exception? = null

        override suspend fun deleteAllFeeds() {
            failure?.let { throw it }
            cleanups += "all"
        }

        override suspend fun deleteFeedsExcept(currentUserId: String) {
            failure?.let { throw it }
            cleanups += "except $currentUserId"
        }

        override fun observeFeed(ownerUserId: String): Flow<List<FeedItemWithJob>> = emptyFlow()

        override suspend fun insertJobs(jobs: List<JobEntity>) = Unit

        override suspend fun insertItems(items: List<FeedItemEntity>) = Unit

        override suspend fun deleteItems(ownerUserId: String) = Unit

        override suspend fun deleteAllItems() = Unit

        override suspend fun deleteItemsExcept(currentUserId: String) = Unit

        override suspend fun deleteUnusedJobs() = Unit
    }
}
