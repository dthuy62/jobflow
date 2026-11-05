package me.dthuy.jobflow.data.remote.dto

import me.dthuy.jobflow.data.remote.ApiJson
import me.dthuy.jobflow.domain.model.DependencyStatus
import me.dthuy.jobflow.domain.model.HealthStatus
import me.dthuy.jobflow.testing.contractFixture
import org.junit.Assert.assertEquals
import org.junit.Test

class HealthDtoTest {
    @Test
    fun `ok example maps to the domain`() {
        val health = ApiJson.decodeFromString<HealthDto>(contractFixture("health.ok.json")).toDomain()

        assertEquals(HealthStatus.OK, health.status)
        assertEquals(DependencyStatus.OK, health.database)
    }

    @Test
    fun `degraded example maps to the domain`() {
        val health = ApiJson.decodeFromString<HealthDto>(contractFixture("health.degraded.json")).toDomain()

        assertEquals(HealthStatus.DEGRADED, health.status)
        assertEquals(DependencyStatus.FAILED, health.database)
    }

    @Test
    fun `values a newer API adds map to UNKNOWN`() {
        val health = HealthDto(status = "maintenance", checks = HealthChecksDto(database = "future")).toDomain()

        assertEquals(HealthStatus.UNKNOWN, health.status)
        assertEquals(DependencyStatus.UNKNOWN, health.database)
    }
}
