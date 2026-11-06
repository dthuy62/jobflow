package me.dthuy.jobflow.ui.health

import java.time.ZoneId
import java.time.format.DateTimeFormatter
import me.dthuy.jobflow.core.common.DataSourceError
import me.dthuy.jobflow.core.common.fold
import me.dthuy.jobflow.domain.model.Health
import me.dthuy.jobflow.domain.model.HealthSnapshot
import me.dthuy.jobflow.domain.model.HealthStatus

private val CHECKED_AT_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm")

fun HealthSnapshot?.toHealthUiState(zone: ZoneId = ZoneId.systemDefault()): HealthUiState {
    if (this == null) return HealthUiState()
    val checkedAtLabel = CHECKED_AT_FORMAT.format(checkedAt.atZone(zone))
    return result.fold(
        onLeft = { HealthUiState(kind = it.toHealthUiKind(), checkedAtLabel = checkedAtLabel) },
        onRight = { it.toHealthUiState(checkedAtLabel) },
    )
}

private fun Health.toHealthUiState(checkedAtLabel: String): HealthUiState = HealthUiState(
    kind = if (status == HealthStatus.OK) HealthUiKind.READY else HealthUiKind.DEGRADED,
    checkedAtLabel = checkedAtLabel,
    databaseStatus = database.wireValue,
)

private fun DataSourceError.toHealthUiKind(): HealthUiKind = when (this) {
    DataSourceError.Remote.Unauthorized -> HealthUiKind.SIGN_IN_REQUIRED
    DataSourceError.Remote.Unreachable,
    is DataSourceError.Remote.Rejected,
    is DataSourceError.Remote.ServerFailure,
    -> HealthUiKind.UNREACHABLE
    DataSourceError.Remote.InvalidResponse,
    DataSourceError.Local.StorageFailure,
    DataSourceError.Unknown,
    -> HealthUiKind.INVALID_RESPONSE
}
