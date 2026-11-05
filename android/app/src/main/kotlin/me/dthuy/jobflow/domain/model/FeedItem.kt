package me.dthuy.jobflow.domain.model

import java.time.Instant

data class FeedItem(val job: Job, val reasons: List<String>, val trackerStatus: TrackerStatus?, val matchedAt: Instant)

enum class TrackerStatus(val wireValue: String) {
    APPLIED("applied"),
    INTERVIEW("interview"),
    REJECTED("rejected"),
    SKIPPED("skipped"),
    UNKNOWN("unknown"),
}
