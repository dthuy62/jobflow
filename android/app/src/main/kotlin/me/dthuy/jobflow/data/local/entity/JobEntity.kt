package me.dthuy.jobflow.data.local.entity

import androidx.room3.Embedded
import androidx.room3.Entity
import androidx.room3.PrimaryKey
import java.time.Instant
import me.dthuy.jobflow.data.remote.dto.JobSummaryDto
import me.dthuy.jobflow.data.remote.dto.SalaryDto
import me.dthuy.jobflow.data.remote.toWireEnum
import me.dthuy.jobflow.domain.model.Job
import me.dthuy.jobflow.domain.model.JobRemotePolicy
import me.dthuy.jobflow.domain.model.Salary
import me.dthuy.jobflow.domain.model.SalaryPeriod

/** A public job posting, shared by every user whose feed lists it. Enums stay wire values, so no value is lost. */
@Entity(tableName = "job")
data class JobEntity(
    @PrimaryKey val jobId: String,
    val title: String,
    val company: String,
    val location: String?,
    val remotePolicy: String,
    @Embedded(prefix = "salary_") val salary: SalaryEntity?,
    val url: String,
    val firstSeenAtEpochMillis: Long,
    val closed: Boolean,
)

/** Room reads a row with every column null as no salary, which is what an empty salary means. */
data class SalaryEntity(val min: Double?, val max: Double?, val currency: String?, val period: String?)

fun JobSummaryDto.toEntity(): JobEntity = JobEntity(
    jobId = jobId,
    title = title,
    company = company,
    location = location,
    remotePolicy = remotePolicy,
    salary = salary?.toEntity(),
    url = url,
    firstSeenAtEpochMillis = Instant.parse(firstSeenAt).toEpochMilli(),
    closed = closed,
)

private fun SalaryDto.toEntity(): SalaryEntity =
    SalaryEntity(min = min, max = max, currency = currency, period = period)

fun JobEntity.toDomain(): Job = Job(
    jobId = jobId,
    title = title,
    company = company,
    location = location,
    remotePolicy = remotePolicy.toWireEnum(JobRemotePolicy::wireValue),
    salary = salary?.toDomain(),
    url = url,
    firstSeenAt = Instant.ofEpochMilli(firstSeenAtEpochMillis),
    closed = closed,
)

private fun SalaryEntity.toDomain(): Salary = Salary(
    min = min,
    max = max,
    currency = currency,
    period = period?.toWireEnum(SalaryPeriod::wireValue),
)
