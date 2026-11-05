package me.dthuy.jobflow.domain.model

import java.time.Instant

data class Job(
    val jobId: String,
    val title: String,
    val company: String,
    val location: String?,
    val remotePolicy: JobRemotePolicy,
    val salary: Salary?,
    val url: String,
    val firstSeenAt: Instant,
    val closed: Boolean,
)

data class Salary(val min: Double?, val max: Double?, val currency: String?, val period: SalaryPeriod?)

enum class JobRemotePolicy(val wireValue: String) {
    REMOTE("remote"),
    HYBRID("hybrid"),
    ONSITE("onsite"),
    UNKNOWN("unknown"),
}

enum class SalaryPeriod(val wireValue: String) {
    HOUR("hour"),
    DAY("day"),
    WEEK("week"),
    MONTH("month"),
    YEAR("year"),
    UNKNOWN("unknown"),
}
