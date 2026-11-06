package me.dthuy.jobflow.ui.health

import java.time.Instant
import java.time.ZoneId
import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.core.common.DataSourceError
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.left
import me.dthuy.jobflow.domain.model.DependencyStatus
import me.dthuy.jobflow.domain.model.Health
import me.dthuy.jobflow.domain.model.HealthSnapshot
import me.dthuy.jobflow.domain.model.HealthStatus
import me.dthuy.jobflow.testing.healthFixture
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HealthUiMapperTest {
    private val zone = ZoneId.of("Asia/Ho_Chi_Minh")
    private val checkedAt = Instant.parse("2026-10-30T02:05:00Z")

    @Test
    fun `no snapshot is loading`() {
        assertEquals(HealthUiKind.LOADING, (null as HealthSnapshot?).toHealthUiState(zone).kind)
    }

    @Test
    fun `ok maps to ready with the database status`() {
        val state = snapshotOf("health.ok.json").toHealthUiState(zone)

        assertEquals(HealthUiKind.READY, state.kind)
        assertEquals("ok", state.databaseStatus)
    }

    @Test
    fun `degraded maps to degraded with the database status`() {
        val state = snapshotOf("health.degraded.json").toHealthUiState(zone)

        assertEquals(HealthUiKind.DEGRADED, state.kind)
        assertEquals("failed", state.databaseStatus)
    }

    @Test
    fun `a status this app does not know is not shown as ready`() {
        val health = Health(HealthStatus.UNKNOWN, DependencyStatus.UNKNOWN)

        val state = HealthSnapshot(Either.Right(health), checkedAt).toHealthUiState(zone)

        assertEquals(HealthUiKind.DEGRADED, state.kind)
    }

    @Test
    fun `unreachable maps to unreachable`() {
        assertEquals(HealthUiKind.UNREACHABLE, failure(DataSourceError.Remote.Unreachable).toHealthUiState(zone).kind)
    }

    @Test
    fun `unauthorized asks the user to sign in`() {
        assertEquals(
            HealthUiKind.SIGN_IN_REQUIRED,
            failure(DataSourceError.Remote.Unauthorized).toHealthUiState(zone).kind,
        )
    }

    @Test
    fun `a refusal or a server failure reads as unreachable, which can be retried`() {
        listOf(
            DataSourceError.Remote.Rejected(ApiErrorCode.RATE_LIMITED),
            DataSourceError.Remote.Rejected(ApiErrorCode.AUTH_UNAVAILABLE),
            DataSourceError.Remote.ServerFailure(500),
        ).forEach { error ->
            assertEquals(error.toString(), HealthUiKind.UNREACHABLE, failure(error).toHealthUiState(zone).kind)
        }
    }

    @Test
    fun `invalid and unknown map to invalid response`() {
        listOf(DataSourceError.Remote.InvalidResponse, DataSourceError.Unknown).forEach { error ->
            val state = failure(error).toHealthUiState(zone)
            assertEquals(error.toString(), HealthUiKind.INVALID_RESPONSE, state.kind)
            assertNull(state.databaseStatus)
        }
    }

    @Test
    fun `checked at is formatted in local time`() {
        assertEquals("09:05", failure(DataSourceError.Remote.Unreachable).toHealthUiState(zone).checkedAtLabel)
    }

    private fun snapshotOf(fixture: String) = HealthSnapshot(
        result = Either.Right(healthFixture(fixture)),
        checkedAt = checkedAt,
    )

    private fun failure(error: DataSourceError) = HealthSnapshot(result = error.left(), checkedAt = checkedAt)
}
