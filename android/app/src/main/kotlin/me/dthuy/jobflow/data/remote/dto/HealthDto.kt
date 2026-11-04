package me.dthuy.jobflow.data.remote.dto

import kotlinx.serialization.Serializable
import me.dthuy.jobflow.data.remote.toWireEnum
import me.dthuy.jobflow.domain.model.DependencyStatus
import me.dthuy.jobflow.domain.model.Health
import me.dthuy.jobflow.domain.model.HealthStatus

@Serializable
data class HealthDto(val status: String, val checks: HealthChecksDto)

@Serializable
data class HealthChecksDto(val database: String)

fun HealthDto.toDomain(): Health = Health(
    status = status.toWireEnum(HealthStatus::wireValue),
    database = checks.database.toWireEnum(DependencyStatus::wireValue),
)
