package me.dthuy.jobflow.data.local.entity

import androidx.room3.Embedded
import androidx.room3.Entity
import androidx.room3.Index
import androidx.room3.Relation
import java.time.Instant
import me.dthuy.jobflow.data.remote.dto.FeedItemDto
import me.dthuy.jobflow.data.remote.toWireEnum
import me.dthuy.jobflow.domain.model.FeedItem
import me.dthuy.jobflow.domain.model.TrackerStatus

/** One job in one user's feed. [ownerUserId] is in the key, so one account never reads another's feed. */
@Entity(tableName = "feed_item", primaryKeys = ["ownerUserId", "jobId"], indices = [Index("jobId")])
data class FeedItemEntity(
    val ownerUserId: String,
    val jobId: String,
    val position: Int,
    val reasons: List<String>,
    val trackerStatus: String?,
    val matchedAtEpochMillis: Long,
)

data class FeedItemWithJob(
    @Embedded val item: FeedItemEntity,
    @Relation(parentColumns = ["jobId"], entityColumns = ["jobId"]) val job: JobEntity,
)

fun FeedItemDto.toEntity(ownerUserId: String, position: Int): FeedItemWithJob = FeedItemWithJob(
    item = FeedItemEntity(
        ownerUserId = ownerUserId,
        jobId = job.jobId,
        position = position,
        reasons = reasons,
        trackerStatus = trackerStatus,
        matchedAtEpochMillis = Instant.parse(matchedAt).toEpochMilli(),
    ),
    job = job.toEntity(),
)

fun FeedItemWithJob.toDomain(): FeedItem = FeedItem(
    job = job.toDomain(),
    reasons = item.reasons,
    trackerStatus = item.trackerStatus?.toWireEnum(TrackerStatus::wireValue),
    matchedAt = Instant.ofEpochMilli(item.matchedAtEpochMillis),
)
