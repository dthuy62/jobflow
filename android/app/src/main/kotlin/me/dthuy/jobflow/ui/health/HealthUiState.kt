package me.dthuy.jobflow.ui.health

import androidx.compose.runtime.Immutable

enum class HealthUiKind { LOADING, READY, DEGRADED, UNREACHABLE, SIGN_IN_REQUIRED, INVALID_RESPONSE }

/** Health as screens render it. Copy comes from string resources by [kind]; [databaseStatus] is the wire value. */
@Immutable
data class HealthUiState(
    val kind: HealthUiKind = HealthUiKind.LOADING,
    val checkedAtLabel: String? = null,
    val databaseStatus: String? = null,
) {
    val isUnhealthy: Boolean get() = kind != HealthUiKind.LOADING && kind != HealthUiKind.READY
}
