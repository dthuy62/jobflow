package me.dthuy.jobflow.data.local

import java.time.Instant
import java.time.format.DateTimeParseException
import me.dthuy.jobflow.data.local.entity.toDomain
import me.dthuy.jobflow.data.local.entity.toEntity
import me.dthuy.jobflow.data.remote.ApiJson
import me.dthuy.jobflow.data.remote.dto.FeedPageDto
import me.dthuy.jobflow.data.remote.dto.JobSummaryDto
import me.dthuy.jobflow.domain.model.FeedItem
import me.dthuy.jobflow.domain.model.Job
import me.dthuy.jobflow.domain.model.JobRemotePolicy
import me.dthuy.jobflow.domain.model.Salary
import me.dthuy.jobflow.domain.model.SalaryPeriod
import me.dthuy.jobflow.domain.model.TrackerStatus
import me.dthuy.jobflow.testing.contractFixture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class FeedMappingTest {
    private val dto = ApiJson.decodeFromString<FeedPageDto>(contractFixture("feed.valid.json")).items.first()

    @Test
    fun `a feed item maps from the contract to the domain, field by field`() {
        val expected = FeedItem(
            job = Job(
                jobId = "job_01",
                title = "Staff Nurse, Pediatrics",
                company = "Example Hospital",
                location = "Hanoi",
                remotePolicy = JobRemotePolicy.ONSITE,
                salary = Salary(min = 30_000_000.0, max = 45_000_000.0, currency = "VND", period = SalaryPeriod.MONTH),
                url = "https://jobs.example.com/postings/1",
                firstSeenAt = Instant.parse("2026-11-02T08:00:00.000Z"),
                closed = false,
            ),
            reasons = listOf("Matches your role: Staff nurse", "In Hanoi", "Salary meets your minimum"),
            trackerStatus = null,
            matchedAt = Instant.parse("2026-11-02T09:30:00.000Z"),
        )

        assertEquals(expected, dto.toEntity("user_a", position = 3).toDomain())
    }

    @Test
    fun `the entity records its owner, its job and its position`() {
        val entity = dto.toEntity("user_a", position = 3)

        assertEquals("user_a", entity.item.ownerUserId)
        assertEquals("job_01", entity.item.jobId)
        assertEquals(3, entity.item.position)
    }

    @Test
    fun `a closed job stays closed`() {
        val job = ApiJson.decodeFromString<JobSummaryDto>(contractFixture("job.closed.json"))

        assertEquals(true, job.toEntity().toDomain().closed)
    }

    @Test
    fun `a salary with a fractional hourly rate and no currency survives`() {
        val job = ApiJson.decodeFromString<JobSummaryDto>(contractFixture("job.hourly.json")).toEntity().toDomain()

        assertEquals(Salary(min = 22.5, max = 28.75, currency = null, period = SalaryPeriod.HOUR), job.salary)
    }

    @Test
    fun `no salary stays no salary`() {
        assertNull(dto.job.copy(salary = null).toEntity().toDomain().salary)
    }

    @Test
    fun `a tracker status comes through`() {
        assertEquals(
            TrackerStatus.APPLIED,
            dto.copy(trackerStatus = "applied").toEntity("user_a", 0).toDomain().trackerStatus,
        )
    }

    @Test
    fun `values a newer API adds map to UNKNOWN`() {
        val job = dto.job.copy(remotePolicy = "orbital", salary = dto.job.salary?.copy(period = "fortnight"))

        val item = dto.copy(job = job, trackerStatus = "offer").toEntity("user_a", 0).toDomain()

        assertEquals(JobRemotePolicy.UNKNOWN, item.job.remotePolicy)
        assertEquals(SalaryPeriod.UNKNOWN, item.job.salary?.period)
        assertEquals(TrackerStatus.UNKNOWN, item.trackerStatus)
    }

    @Test
    fun `a malformed timestamp fails when the API response is mapped`() {
        assertThrows(DateTimeParseException::class.java) { dto.job.copy(firstSeenAt = "yesterday").toEntity() }
        assertThrows(DateTimeParseException::class.java) { dto.copy(matchedAt = "yesterday").toEntity("user_a", 0) }
    }
}
