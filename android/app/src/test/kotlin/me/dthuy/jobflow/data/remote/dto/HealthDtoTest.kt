package me.dthuy.jobflow.data.remote.dto

import me.dthuy.jobflow.data.remote.ApiJson
import me.dthuy.jobflow.domain.model.ApiVersion
import me.dthuy.jobflow.domain.model.HealthStatus
import me.dthuy.jobflow.domain.model.ReadinessStatus
import me.dthuy.jobflow.domain.model.ScannerCommandType
import me.dthuy.jobflow.domain.model.ScriptReadinessCheckName
import me.dthuy.jobflow.domain.model.ScriptReadinessCheckStatus
import me.dthuy.jobflow.domain.model.WorkspaceStatus
import me.dthuy.jobflow.testing.contractFixture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HealthDtoTest {
    @Test
    fun decodesHealthDtoAndMapsToDomain() {
        val health = ApiJson.decodeFromString<HealthDto>(contractFixture("health.ready.json")).toDomain()

        assertEquals(HealthStatus.READY, health.status)
        assertEquals(ApiVersion.V1, health.apiVersion)
        assertEquals(WorkspaceStatus.READY, health.workspace.status)
        assertTrue(health.workspace.detected)
        assertEquals(ReadinessStatus.READY, health.careerOps.status)
        assertEquals(ScannerCommandType.LOCAL_SCRIPT, health.careerOps.scanner.commandType)
        assertEquals(ScriptReadinessCheckName.DOCTOR_SCRIPT, health.careerOps.scanner.checks.first().name)
        assertEquals(ScriptReadinessCheckStatus.READY, health.careerOps.scanner.checks.first().status)
        assertFalse(health.capabilities.scan)
        assertEquals("2026-06-15T10:30:00.000Z", health.serverTime)
    }

    @Test
    fun mapsDomainHealthToDto() {
        val health = ApiJson.decodeFromString<HealthDto>(contractFixture("health.not-ready.json")).toDomain()

        val dto = health.toDto()

        assertEquals("notReady", dto.status)
        assertEquals("missing", dto.workspace.status)
        assertEquals(listOf("doctor-script", "scan-script", "portal-config"), dto.careerOps.scanner.missingRequirements)
        assertFalse(dto.capabilities.cv)
    }
}
