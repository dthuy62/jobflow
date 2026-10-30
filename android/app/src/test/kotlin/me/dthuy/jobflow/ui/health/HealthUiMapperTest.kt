package me.dthuy.jobflow.ui.health

import java.time.Instant
import java.time.ZoneId
import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.left
import me.dthuy.jobflow.domain.model.HealthSnapshot
import me.dthuy.jobflow.testing.healthFixture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HealthUiMapperTest {
    private val checkedAt = Instant.parse("2026-10-30T02:05:00Z")
    private val zone = ZoneId.of("Asia/Ho_Chi_Minh")

    @Test
    fun `no snapshot yet is loading`() {
        assertEquals(HealthUiKind.LOADING, (null as HealthSnapshot?).toHealthUiState(zone).kind)
    }

    @Test
    fun `ready health maps to ready`() {
        val state = snapshotOf("health.ready.json").toHealthUiState(zone)

        assertEquals(HealthUiKind.READY, state.kind)
        assertEquals("Career Ops workspace is ready.", state.serverMessage)
        assertEquals("ready", state.workspaceStatus)
        assertEquals("ready", state.scannerStatus)
        assertEquals("2026-06-15T10:30:00.000Z", state.serverTime)
    }

    @Test
    fun `not ready collects missing requirements then messages as guidance`() {
        val state = snapshotOf("health.not-ready.json").toHealthUiState(zone)

        assertEquals(HealthUiKind.NOT_READY, state.kind)
        assertEquals("workspace", state.guidance.first())
        assertEquals(listOf("workspace", "doctor-script", "scan-script", "portal-config"), state.guidance.take(4))
    }

    @Test
    fun `unreachable maps to unreachable`() {
        assertEquals(HealthUiKind.UNREACHABLE, failure(AppError.Unreachable).toHealthUiState(zone).kind)
    }

    @Test
    fun `unauthorized maps to pairing required`() {
        assertEquals(HealthUiKind.PAIRING_REQUIRED, failure(AppError.Unauthorized).toHealthUiState(zone).kind)
    }

    @Test
    fun `rejected server failure invalid and unknown map to invalid response`() {
        listOf(
            AppError.Rejected(ApiErrorCode.WORKSPACE_UNHEALTHY),
            AppError.ServerFailure(500),
            AppError.InvalidResponse,
            AppError.Unknown,
        ).forEach { error ->
            val state = failure(error).toHealthUiState(zone)
            assertEquals(error.toString(), HealthUiKind.INVALID_RESPONSE, state.kind)
            assertNull(state.workspaceStatus)
        }
    }

    @Test
    fun `checked at is formatted in local time`() {
        assertEquals("09:05", failure(AppError.Unreachable).toHealthUiState(zone).checkedAtLabel)
    }

    private fun snapshotOf(fixture: String) = HealthSnapshot(
        result = Either.Right(healthFixture(fixture)),
        checkedAt = checkedAt,
    )

    private fun failure(error: AppError) = HealthSnapshot(result = error.left(), checkedAt = checkedAt)
}
