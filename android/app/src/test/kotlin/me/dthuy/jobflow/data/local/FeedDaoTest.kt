package me.dthuy.jobflow.data.local

import android.content.ContextWrapper
import androidx.room3.Room
import androidx.sqlite.driver.bundled.BundledSQLiteDriver
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import me.dthuy.jobflow.data.local.dao.FeedDao
import me.dthuy.jobflow.data.local.entity.FeedItemEntity
import me.dthuy.jobflow.data.local.entity.FeedItemWithJob
import me.dthuy.jobflow.data.local.entity.JobEntity
import me.dthuy.jobflow.data.local.entity.toDomain
import me.dthuy.jobflow.data.local.entity.toEntity
import me.dthuy.jobflow.data.remote.ApiJson
import me.dthuy.jobflow.data.remote.dto.FeedPageDto
import me.dthuy.jobflow.testing.contractFixture
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class FeedDaoTest {
    private lateinit var database: JobFlowDatabase
    private lateinit var dao: FeedDao

    @Before
    fun setUp() {
        database = Room.inMemoryDatabaseBuilder<JobFlowDatabase>(ContextWrapper(null))
            .setDriver(BundledSQLiteDriver())
            .build()
        dao = database.feedDao()
    }

    @After
    fun tearDown() {
        database.close()
    }

    @Test
    fun `a feed from the contract comes back from the database unchanged`() = runTest {
        val page = ApiJson.decodeFromString<FeedPageDto>(contractFixture("feed.valid.json"))
        val items = page.items.mapIndexed { position, item -> item.toEntity("user_a", position) }
        val jobs = page.items.map { it.job.toEntity() }

        dao.replaceFeed("user_a", items, jobs)

        val expected = items.zip(jobs) { item, job -> FeedItemWithJob(item, job) }
        assertEquals(expected.map { it.toDomain() }, dao.observeFeed("user_a").first().map { it.toDomain() })
    }

    @Test
    fun `a job with no salary reads back with no salary`() = runTest {
        dao.replaceFeed("user_a", listOf(item("user_a", "job_1", 0)), listOf(job("job_1")))

        assertNull(dao.observeFeed("user_a").first().single().job.salary)
    }

    @Test
    fun `the feed reads in position order`() = runTest {
        dao.replaceFeed(
            "user_a",
            listOf(item("user_a", "job_1", 1), item("user_a", "job_2", 0)),
            listOf(job("job_1"), job("job_2")),
        )

        assertEquals(listOf("job_2", "job_1"), dao.observeFeed("user_a").first().map { it.item.jobId })
    }

    @Test
    fun `replacing a feed removes what the new one left out`() = runTest {
        dao.replaceFeed("user_a", listOf(item("user_a", "job_1", 0)), listOf(job("job_1")))

        dao.replaceFeed("user_a", listOf(item("user_a", "job_2", 0)), listOf(job("job_2")))

        assertEquals(listOf("job_2"), dao.observeFeed("user_a").first().map { it.item.jobId })
        assertEquals(listOf("job_2"), dao.jobIds())
    }

    @Test
    fun `one user never reads another user's feed`() = runTest {
        dao.replaceFeed("user_a", listOf(item("user_a", "job_1", 0)), listOf(job("job_1")))

        assertTrue(dao.observeFeed("user_b").first().isEmpty())
    }

    @Test
    fun `a job two users share updates for both, and replacing one feed keeps it for the other`() = runTest {
        dao.replaceFeed("user_a", listOf(item("user_a", "job_1", 0)), listOf(job("job_1", "Old")))
        dao.replaceFeed("user_b", listOf(item("user_b", "job_1", 0)), listOf(job("job_1", "New")))

        assertEquals("New", dao.observeFeed("user_a").first().single().job.title)

        dao.replaceFeed("user_b", emptyList(), emptyList())

        assertEquals("New", dao.observeFeed("user_a").first().single().job.title)
    }

    @Test
    fun `deleting a feed removes that user's rows and the jobs nobody else needs`() = runTest {
        dao.replaceFeed(
            "user_a",
            listOf(item("user_a", "job_1", 0), item("user_a", "job_2", 1)),
            listOf(job("job_1"), job("job_2")),
        )
        dao.replaceFeed("user_b", listOf(item("user_b", "job_2", 0)), listOf(job("job_2")))

        dao.deleteFeed("user_a")

        assertTrue(dao.observeFeed("user_a").first().isEmpty())
        assertEquals(listOf("job_2"), dao.observeFeed("user_b").first().map { it.item.jobId })
        assertEquals(listOf("job_2"), dao.jobIds())
    }

    @Test
    fun `a change of account removes every other user's feed`() = runTest {
        dao.replaceFeed("user_a", listOf(item("user_a", "job_1", 0)), listOf(job("job_1")))
        dao.replaceFeed("user_b", listOf(item("user_b", "job_2", 0)), listOf(job("job_2")))

        dao.deleteFeedsExcept("user_b")

        assertTrue(dao.observeFeed("user_a").first().isEmpty())
        assertEquals(listOf("job_2"), dao.observeFeed("user_b").first().map { it.item.jobId })
        assertEquals(listOf("job_2"), dao.jobIds())
    }

    private fun item(user: String, jobId: String, position: Int) = FeedItemEntity(
        ownerUserId = user,
        jobId = jobId,
        position = position,
        reasons = listOf("Matches your role"),
        trackerStatus = null,
        matchedAtEpochMillis = 1L,
    )

    private fun job(jobId: String, title: String = "Nurse") = JobEntity(
        jobId = jobId,
        title = title,
        company = "Example",
        location = null,
        remotePolicy = "onsite",
        salary = null,
        url = "https://jobs.example.com/$jobId",
        firstSeenAtEpochMillis = 1L,
        closed = false,
    )
}
