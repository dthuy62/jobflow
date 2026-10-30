package me.dthuy.jobflow.data.remote.dto

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import me.dthuy.jobflow.data.remote.ApiJson
import me.dthuy.jobflow.domain.model.HealthStatus
import me.dthuy.jobflow.domain.model.WorkspaceStatus
import me.dthuy.jobflow.testing.contractFixture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class ApiContractCompatibilityTest {
    private val json = ApiJson

    @Test
    fun parsesEveryCheckedInContractExample() {
        assertNotNull(json.decodeFromString<HealthDto>(fixture("health.ready.json")))
        assertNotNull(json.decodeFromString<HealthDto>(fixture("health.not-ready.json")))
        assertNotNull(json.decodeFromString<CvDto>(fixture("cv.valid.json")))
        assertNotNull(json.decodeFromString<ProfileDto>(fixture("profile.valid.json")))
        assertNotNull(json.decodeFromString<PortalDto>(fixture("portal.valid.json")))
        assertNotNull(json.decodeFromString<ApiCollectionDto>(fixture("collection.valid.json")))
        assertNotNull(json.decodeFromString<OfferDto>(fixture("offer.valid.json")))
        assertNotNull(json.decodeFromString<ScanRunDto>(fixture("scan-run.running.json")))
        assertNotNull(json.decodeFromString<ReportListItemDto>(fixture("report.list-item.valid.json")))
        assertNotNull(json.decodeFromString<ReportDetailDto>(fixture("report.detail.valid.json")))
        assertNotNull(json.decodeFromString<ArtifactDto>(fixture("artifact.valid.json")))
        assertNotNull(json.decodeFromString<ErrorResponseDto>(fixture("errors/unauthorized.json")))
        assertNotNull(json.decodeFromString<ErrorResponseDto>(fixture("errors/validation.json")))
        assertNotNull(json.decodeFromString<ErrorResponseDto>(fixture("errors/workspace-unhealthy.json")))
        assertNotNull(json.decodeFromString<ErrorResponseDto>(fixture("errors/path-outside-workspace.json")))
        assertNotNull(json.decodeFromString<ErrorResponseDto>(fixture("errors/scan-already-running.json")))
    }

    @Test
    fun productionJsonIgnoresAdditiveUnknownFields() {
        val original = json.parseToJsonElement(fixture("offer.valid.json")).jsonObject
        val withUnknown = JsonObject(original + ("futureField" to buildJsonObject { put("value", true) }))

        val offer = json.decodeFromString<OfferDto>(withUnknown.toString())

        assertTrue(offer.id.isNotBlank())
    }

    @Test
    fun missingRequiredFieldsAndWrongTypesFailDeserialization() {
        val original = json.parseToJsonElement(fixture("offer.valid.json")).jsonObject
        val missingId = JsonObject(original - "id")
        val wrongScore = JsonObject(original + ("score" to buildJsonObject { put("value", true) }))

        assertThrows(Exception::class.java) { json.decodeFromString<OfferDto>(missingId.toString()) }
        assertThrows(Exception::class.java) { json.decodeFromString<OfferDto>(wrongScore.toString()) }
    }

    @Test
    fun explicitNullOptionalFieldsAreAccepted() {
        val report = json.decodeFromString<ReportListItemDto>(fixture("report.list-item.valid.json"))
        val offer = json.decodeFromString<OfferDto>(fixture("offer.valid.json"))

        assertTrue(report.updatedAt == null)
        assertTrue(offer.lastSeenAt == null)
        assertTrue(offer.reportId == null)
    }

    @Test
    fun unknownWireValuesMapToUnknown() {
        val original = json.parseToJsonElement(fixture("health.ready.json")).jsonObject
        val workspace = original.getValue("workspace").jsonObject
        val future =
            JsonObject(
                original +
                    mapOf(
                        "status" to JsonPrimitive("maintenance"),
                        "workspace" to JsonObject(workspace + ("status" to JsonPrimitive("future"))),
                    ),
            )

        val health = json.decodeFromString<HealthDto>(future.toString()).toDomain()

        assertEquals(HealthStatus.UNKNOWN, health.status)
        assertEquals(WorkspaceStatus.UNKNOWN, health.workspace.status)
    }

    private fun fixture(relativePath: String): String = contractFixture(relativePath)
}
