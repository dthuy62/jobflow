package me.dthuy.jobflow.data.local

import java.time.Instant
import me.dthuy.jobflow.data.local.entity.FeedItemWithJob
import me.dthuy.jobflow.data.local.entity.toDomain
import me.dthuy.jobflow.data.local.entity.toEntity
import me.dthuy.jobflow.data.remote.ApiJson
import me.dthuy.jobflow.data.remote.dto.FeedPageDto
import me.dthuy.jobflow.data.remote.dto.JobSummaryDto
import me.dthuy.jobflow.domain.model.JobRemotePolicy
import me.dthuy.jobflow.domain.model.SalaryPeriod
import me.dthuy.jobflow.domain.model.TrackerStatus
import me.dthuy.jobflow.testing.contractFixture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FeedMappingTest {
    private val page = ApiJson.decodeFromString<FeedPageDto>(contractFixture("feed.valid.json"))
    private val dto = page.items.first()

    @Test
    fun `a feed item maps from the contract to the domain`() {
        val entity = dto.toEntity(ownerUserId = "user_a", position = 3)

        val item = FeedItemWithJob(entity, dto.job.toEntity()).toDomain()

        assertEquals("user_a", entity.ownerUserId)
        assertEquals(3, entity.position)
        assertEquals(dto.job.jobId, entity.jobId)
        assertEquals(dto.reasons, item.reasons)
        assertNull(item.trackerStatus)
        assertEquals(Instant.parse(dto.matchedAt), item.matchedAt)
        assertEquals(dto.job.title, item.job.title)
        assertEquals(JobRemotePolicy.ONSITE, item.job.remotePolicy)
        assertEquals(Instant.parse(dto.job.firstSeenAt), item.job.firstSeenAt)
        assertEquals(SalaryPeriod.MONTH, item.job.salary?.period)
    }

    @Test
    fun `a salary with a fractional hourly rate and no currency survives`() {
        val job = ApiJson.decodeFromString<JobSummaryDto>(contractFixture("job.hourly.json")).toEntity().toDomain()

        assertEquals(22.5, checkNotNull(job.salary?.min), 0.0)
        assertNull(job.salary?.currency)
        assertEquals(SalaryPeriod.HOUR, job.salary?.period)
    }

    @Test
    fun `no salary stays no salary`() {
        assertNull(dto.job.copy(salary = null).toEntity().toDomain().salary)
    }

    @Test
    fun `values a newer API adds map to UNKNOWN`() {
        val job = dto.job.copy(remotePolicy = "orbital", salary = dto.job.salary?.copy(period = "fortnight"))
        val entity = dto.copy(job = job, trackerStatus = "offer").toEntity("user_a", 0)

        val item = FeedItemWithJob(entity, job.toEntity()).toDomain()

        assertEquals(JobRemotePolicy.UNKNOWN, item.job.remotePolicy)
        assertEquals(SalaryPeriod.UNKNOWN, item.job.salary?.period)
        assertEquals(TrackerStatus.UNKNOWN, item.trackerStatus)
    }
}
