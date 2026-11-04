package me.dthuy.jobflow.data.local

import androidx.room3.Entity

/**
 * One API response kept for offline viewing, as the JSON the API sent, so a contract change needs no migration.
 * [ownerUserId] is part of the key, so one account on a shared device can never read another's copy.
 */
@Entity(tableName = "cached_response", primaryKeys = ["ownerUserId", "key"])
data class CachedResponseEntity(
    val ownerUserId: String,
    val key: String,
    val json: String,
    val syncedAtEpochMillis: Long,
)
