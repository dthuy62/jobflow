package me.dthuy.jobflow.ui.chat

import androidx.compose.runtime.Immutable
import kotlinx.collections.immutable.ImmutableList
import kotlinx.collections.immutable.persistentListOf
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.mvi.UiEffect
import me.dthuy.jobflow.core.mvi.UiIntent
import me.dthuy.jobflow.core.mvi.UiState
import me.dthuy.jobflow.domain.model.ChatMessage

@Immutable
data class ChatState(
    val messages: ImmutableList<ChatMessage> = persistentListOf(),
    val input: String = "",
    /** Non-null while the assistant reply is being streamed. */
    val streamingText: String? = null,
    val error: AppError? = null,
) : UiState {
    val isStreaming: Boolean get() = streamingText != null
    val canSend: Boolean get() = input.isNotBlank() && !isStreaming
}

sealed interface ChatIntent : UiIntent {
    data class InputChanged(val text: String) : ChatIntent

    data object SendClicked : ChatIntent

    data object ErrorDismissed : ChatIntent

    data object SettingsClicked : ChatIntent
}

sealed interface ChatEffect : UiEffect {
    data object ScrollToBottom : ChatEffect

    data object NavigateToSettings : ChatEffect
}
