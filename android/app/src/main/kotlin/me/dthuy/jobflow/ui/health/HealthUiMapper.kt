package me.dthuy.jobflow.ui.health

import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlinx.collections.immutable.toImmutableList
import me.dthuy.jobflow.core.common.AppError
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

private fun Health.toHealthUiState(checkedAtLabel: String): HealthUiState {
    val missing = workspace.missingRequirements + careerOps.scanner.missingRequirements
    val messages = workspace.messages + careerOps.scanner.messages
    return HealthUiState(
        kind = if (status == HealthStatus.READY) HealthUiKind.READY else HealthUiKind.NOT_READY,
        serverMessage = messages.firstOrNull(),
        firstMissing = missing.firstOrNull(),
        checkedAtLabel = checkedAtLabel,
        serverTime = serverTime,
        workspaceStatus = workspace.status.wireValue,
        scannerStatus = careerOps.scanner.status.wireValue,
        guidance = (missing + messages).toImmutableList(),
    )
}

private fun AppError.toHealthUiKind(): HealthUiKind = when (this) {
    AppError.Unreachable -> HealthUiKind.UNREACHABLE
    AppError.Unauthorized -> HealthUiKind.PAIRING_REQUIRED
    is AppError.Rejected,
    is AppError.ServerFailure,
    AppError.InvalidResponse,
    AppError.Unknown,
    is AppError.Feature,
    -> HealthUiKind.INVALID_RESPONSE
}
