package me.dthuy.jobflow.data.remote.dto

import java.nio.file.Files
import kotlin.io.path.isRegularFile
import kotlin.io.path.relativeTo
import kotlin.streams.asSequence
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import me.dthuy.jobflow.core.network.ApiJson
import me.dthuy.jobflow.core.network.ErrorDetailsDto
import me.dthuy.jobflow.core.network.ErrorResponseDto
import me.dthuy.jobflow.data.auth.GuestResponseDto
import me.dthuy.jobflow.data.auth.LogoutRequest
import me.dthuy.jobflow.data.auth.MeDto
import me.dthuy.jobflow.data.auth.RefreshRequest
import me.dthuy.jobflow.data.auth.SessionTokensDto
import me.dthuy.jobflow.data.auth.SsoRequest
import me.dthuy.jobflow.data.auth.SsoResponseDto
import me.dthuy.jobflow.testing.contractExamplesDir
import me.dthuy.jobflow.testing.contractFixture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class ApiContractCompatibilityTest {
    private val json = ApiJson

    private inline fun <reified T> parse(): (String) -> T = { json.decodeFromString<T>(it) }

    private val parsers: Map<String, (String) -> Any> =
        mapOf(
            "auth-guest.valid.json" to parse<GuestResponseDto>(),
            "auth-sso.merged.json" to parse<SsoResponseDto>(),
            "auth-sso.not-merged.json" to parse<SsoResponseDto>(),
            "company.valid.json" to parse<CompanyDto>(),
            "cv-import.valid.json" to parse<CvImportDto>(),
            "cv.valid.json" to parse<CvDto>(),
            "entitlement.free.json" to parse<EntitlementDto>(),
            "entitlement.paid.json" to parse<EntitlementDto>(),
            "evaluation.analyzing.json" to parse<EvaluationDto>(),
            "evaluation.done.json" to parse<EvaluationDto>(),
            "evaluation.failed.json" to parse<EvaluationDto>(),
            "evaluation.queued.json" to parse<EvaluationDto>(),
            "feed.empty.json" to parse<FeedPageDto>(),
            "feed.valid.json" to parse<FeedPageDto>(),
            "health.degraded.json" to parse<HealthDto>(),
            "health.ok.json" to parse<HealthDto>(),
            "job.closed.json" to parse<JobDto>(),
            "job.hourly.json" to parse<JobDto>(),
            "job.valid.json" to parse<JobDto>(),
            "me.guest.json" to parse<MeDto>(),
            "me.valid.json" to parse<MeDto>(),
            "preferences.empty.json" to parse<PreferencesDto>(),
            "preferences.valid.json" to parse<PreferencesDto>(),
            "session-tokens.valid.json" to parse<SessionTokensDto>(),
            "tracker-entry.valid.json" to parse<TrackerEntryDto>(),
            "tracker.valid.json" to parse<TrackerPageDto>(),
            "requests/auth-logout.json" to parse<LogoutRequest>(),
            "requests/auth-refresh.json" to parse<RefreshRequest>(),
            "requests/auth-sso.json" to parse<SsoRequest>(),
            "requests/company-create.json" to parse<CompanyCreateRequest>(),
            "requests/cv-update.json" to parse<CvUpdateRequest>(),
            "requests/device-update.json" to parse<DeviceUpdateRequest>(),
            "requests/preferences-update.json" to parse<PreferencesDto>(),
            "requests/purchase-create.json" to parse<PurchaseRequest>(),
            "requests/tracker-update.json" to parse<TrackerUpdateRequest>(),
        )

    @Test
    fun parsesEveryCheckedInContractExample() {
        val examples =
            Files.walk(contractExamplesDir()).use { paths ->
                paths.asSequence()
                    .filter { it.isRegularFile() && it.toString().endsWith(".json") }
                    .map { it.relativeTo(contractExamplesDir()).toString() }
                    .toList()
            }
        val unmapped = examples.filterNot { it.startsWith("errors/") || it in parsers }

        assertEquals("Examples with no DTO here", emptyList<String>(), unmapped)
        assertEquals("Parsers with no example", emptySet<String>(), parsers.keys - examples.toSet())
        parsers.forEach { (file, parse) -> assertNotNull(file, parse(contractFixture(file))) }
        examples.filter { it.startsWith("errors/") }.forEach { file ->
            assertNotNull(file, json.decodeFromString<ErrorResponseDto>(contractFixture(file)))
        }
    }

    @Test
    fun productionJsonIgnoresAdditiveUnknownFields() {
        val original = json.parseToJsonElement(contractFixture("me.valid.json")).jsonObject
        val withUnknown = JsonObject(original + ("futureField" to buildJsonObject { put("value", true) }))

        val me = json.decodeFromString<MeDto>(withUnknown.toString())

        assertTrue(me.userId.isNotBlank())
    }

    @Test
    fun missingRequiredFieldsAndWrongTypesFailDeserialization() {
        val original = json.parseToJsonElement(contractFixture("me.valid.json")).jsonObject
        val missingId = JsonObject(original - "userId")
        val wrongType = JsonObject(original + ("isAnonymous" to JsonPrimitive("yes")))

        assertThrows(Exception::class.java) { json.decodeFromString<MeDto>(missingId.toString()) }
        assertThrows(Exception::class.java) { json.decodeFromString<MeDto>(wrongType.toString()) }
    }

    @Test
    fun integersBeyondThirtyTwoBitsAreAccepted() {
        val quota = json.decodeFromString<QuotaDto>(
            """{"feature":"evaluation","used":0,"limit":3000000000,"resetsAt":null}""",
        )
        val error = json.decodeFromString<ErrorDetailsDto>("""{"retryAfterSeconds":3000000000}""")

        assertEquals(3_000_000_000L, quota.limit)
        assertEquals(3_000_000_000L, error.retryAfterSeconds)
    }

    @Test
    fun explicitNullOptionalFieldsAreAccepted() {
        val job = json.decodeFromString<JobDto>(contractFixture("job.closed.json"))

        assertTrue(job.jobId.isNotBlank())
        val evaluation = json.decodeFromString<EvaluationDto>(contractFixture("evaluation.queued.json"))
        assertEquals(null, evaluation.result)
    }
}
