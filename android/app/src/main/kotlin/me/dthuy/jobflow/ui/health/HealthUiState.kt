package me.dthuy.jobflow.ui.health

import androidx.compose.runtime.Immutable
import kotlinx.collections.immutable.ImmutableList
import kotlinx.collections.immutable.persistentListOf

enum class HealthUiKind { LOADING, READY, NOT_READY, UNREACHABLE, PAIRING_REQUIRED, INVALID_RESPONSE }

/**
 * Health as screens render it. Copy comes from string resources by [kind]; the text fields here are values the
 * wrapper sent (messages, requirement names, wire statuses) and are shown as they are.
 */
@Immutable
data class HealthUiState(
    val kind: HealthUiKind = HealthUiKind.LOADING,
    val serverMessage: String? = null,
    val firstMissing: String? = null,
    val checkedAtLabel: String? = null,
    val serverTime: String? = null,
    val workspaceStatus: String? = null,
    val scannerStatus: String? = null,
    val guidance: ImmutableList<String> = persistentListOf(),
) {
    val isUnhealthy: Boolean get() = kind != HealthUiKind.LOADING && kind != HealthUiKind.READY
}
