package me.dthuy.jobflow.data.local

import android.content.ContextWrapper
import androidx.room3.Room
import androidx.sqlite.driver.bundled.BundledSQLiteDriver
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class ResponseCacheDaoTest {
    private lateinit var database: JobFlowDatabase
    private lateinit var dao: ResponseCacheDao

    @Before
    fun setUp() {
        database = Room.inMemoryDatabaseBuilder<JobFlowDatabase>(ContextWrapper(null))
            .setDriver(BundledSQLiteDriver())
            .build()
        dao = database.responseCache()
    }

    @After
    fun tearDown() {
        database.close()
    }

    @Test
    fun `a stored response comes back as it was`() = runTest {
        val response = cached("user_a", "feed", """{"items":[]}""")

        dao.put(response)

        assertEquals(response, dao.observe("user_a", "feed").first())
    }

    @Test
    fun `nothing stored reads as null`() = runTest {
        assertNull(dao.observe("user_a", "feed").first())
    }

    @Test
    fun `a newer response replaces the older one`() = runTest {
        dao.put(cached("user_a", "feed", "old"))
        dao.put(cached("user_a", "feed", "new"))

        assertEquals("new", dao.observe("user_a", "feed").first()?.json)
    }

    @Test
    fun `one user never reads another user's copy`() = runTest {
        dao.put(cached("user_a", "feed", "a"))

        assertNull(dao.observe("user_b", "feed").first())
    }

    @Test
    fun `deleting a user removes only that user's copies`() = runTest {
        dao.put(cached("user_a", "feed", "a"))
        dao.put(cached("user_a", "tracker", "a"))
        dao.put(cached("user_b", "feed", "b"))

        dao.deleteForUser("user_a")

        assertNull(dao.observe("user_a", "feed").first())
        assertNull(dao.observe("user_a", "tracker").first())
        assertEquals("b", dao.observe("user_b", "feed").first()?.json)
    }

    private fun cached(user: String, key: String, json: String) =
        CachedResponseEntity(ownerUserId = user, key = key, json = json, syncedAtEpochMillis = 1L)
}
