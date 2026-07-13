package me.dthuy.jobflow.careerops

import kotlinx.serialization.json.Json
import me.dthuy.jobflow.data.models.HealthDto
import me.dthuy.jobflow.data.models.toDomain
import me.dthuy.jobflow.data.models.toDto
import me.dthuy.jobflow.domain.model.ApiVersion
import me.dthuy.jobflow.domain.model.HealthStatus
import me.dthuy.jobflow.domain.model.ReadinessStatus
import me.dthuy.jobflow.domain.model.ScannerCommandType
import me.dthuy.jobflow.domain.model.ScriptReadinessCheckName
import me.dthuy.jobflow.domain.model.ScriptReadinessCheckStatus
import me.dthuy.jobflow.domain.model.WorkspaceStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HealthDtoTest {
    private val json =
        Json {
            ignoreUnknownKeys = true
        }

    @Test
    fun decodesHealthDtoAndMapsToDomain() {
        val dto =
            json.decodeFromString<HealthDto>(
                """
                {
                  "status": "ready",
                  "apiVersion": "v1",
                  "workspace": {
                    "status": "ready",
                    "detected": true,
                    "careerOpsVersion": null,
                    "missingRequirements": [],
                    "messages": ["Career Ops workspace is ready."]
                  },
                  "careerOps": {
                    "status": "ready",
                    "executionMode": "local-script-runner",
                    "providerApiKeyRequired": false,
                    "aiCliRequired": false,
                    "scanner": {
                      "status": "ready",
                      "commandType": "local-script",
                      "missingRequirements": [],
                      "checks": [
                        { "name": "doctor-script", "status": "ready" },
                        { "name": "scan-script", "status": "ready" },
                        { "name": "portal-config", "status": "ready" }
                      ],
                      "messages": ["Local Career Ops scan script prerequisites are present."]
                    }
                  },
                  "capabilities": {
                    "cv": true,
                    "profile": true,
                    "portals": true,
                    "scan": false,
                    "reports": false,
                    "artifacts": false,
                    "cvConversion": false,
                    "geminiEvaluation": false
                  },
                  "serverTime": "2026-06-15T10:30:00.000Z"
                }
                """.trimIndent(),
            )

        val health = dto.toDomain()

        assertEquals(HealthStatus.READY, health.status)
        assertEquals(ApiVersion.V1, health.apiVersion)
        assertEquals(WorkspaceStatus.READY, health.workspace.status)
        assertTrue(health.workspace.detected)
        assertEquals(ReadinessStatus.READY, health.careerOps.status)
        assertEquals(ScannerCommandType.LOCAL_SCRIPT, health.careerOps.scanner.commandType)
        assertEquals(
            ScriptReadinessCheckName.DOCTOR_SCRIPT,
            health.careerOps.scanner.checks
                .first()
                .name,
        )
        assertEquals(
            ScriptReadinessCheckStatus.READY,
            health.careerOps.scanner.checks
                .first()
                .status,
        )
        assertFalse(health.capabilities.scan)
        assertEquals("2026-06-15T10:30:00.000Z", health.serverTime)
    }

    @Test
    fun mapsDomainHealthToDto() {
        val health =
            json
                .decodeFromString<HealthDto>(
                    """
                    {
                      "status": "notReady",
                      "apiVersion": "v1",
                      "workspace": {
                        "status": "missing",
                        "detected": false,
                        "careerOpsVersion": null,
                        "missingRequirements": ["workspace"],
                        "messages": ["Career Ops workspace is missing."]
                      },
                      "careerOps": {
                        "status": "notReady",
                        "executionMode": "local-script-runner",
                        "providerApiKeyRequired": false,
                        "aiCliRequired": false,
                        "scanner": {
                          "status": "notReady",
                          "commandType": "local-script",
                          "missingRequirements": ["doctor-script"],
                          "checks": [
                            { "name": "doctor-script", "status": "missing" }
                          ],
                          "messages": ["Local Career Ops scan script prerequisites are incomplete."]
                        }
                      },
                      "capabilities": {
                        "cv": false,
                        "profile": false,
                        "portals": false,
                        "scan": false,
                        "reports": false,
                        "artifacts": false,
                        "cvConversion": false,
                        "geminiEvaluation": false
                      },
                      "serverTime": "2026-06-15T10:30:00.000Z"
                    }
                    """.trimIndent(),
                ).toDomain()

        val dto = health.toDto()

        assertEquals("notReady", dto.status)
        assertEquals("missing", dto.workspace.status)
        assertEquals(
            "doctor-script",
            dto.careerOps.scanner.missingRequirements
                .single(),
        )
        assertFalse(dto.capabilities.cv)
    }
}
