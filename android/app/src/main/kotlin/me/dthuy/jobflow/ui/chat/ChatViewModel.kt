package me.dthuy.jobflow.ui.chat

import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.collections.immutable.toImmutableList
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import me.dthuy.jobflow.core.mvi.MviViewModel
import me.dthuy.jobflow.domain.usecase.ObserveMessagesUseCase
import me.dthuy.jobflow.domain.usecase.ReplyProgress
import me.dthuy.jobflow.domain.usecase.SendMessageUseCase

@HiltViewModel
class ChatViewModel @Inject constructor(
    observeMessages: ObserveMessagesUseCase,
    private val sendMessage: SendMessageUseCase,
) : MviViewModel<ChatState, ChatIntent, ChatEffect>(ChatState()) {
    private var sendJob: Job? = null

    init {
        observeMessages()
            .onEach { messages ->
                setState { copy(messages = messages.toImmutableList()) }
                sendEffect(ChatEffect.ScrollToBottom)
            }.launchIn(viewModelScope)
    }

    override fun handleIntent(intent: ChatIntent) {
        when (intent) {
            is ChatIntent.InputChanged -> setState { copy(input = intent.text) }
            ChatIntent.SendClicked -> send()
            ChatIntent.ErrorDismissed -> setState { copy(error = null) }
            ChatIntent.SettingsClicked -> sendEffect(ChatEffect.NavigateToSettings)
        }
    }

    private fun send() {
        val text = state.value.input.trim()
        if (text.isEmpty() || state.value.isStreaming) return
        setState { copy(input = "", streamingText = "", error = null) }
        sendJob?.cancel()
        sendJob =
            viewModelScope.launch {
                sendMessage(text).collect { progress ->
                    when (progress) {
                        is ReplyProgress.Streaming -> setState { copy(streamingText = progress.text) }
                        ReplyProgress.Done -> setState { copy(streamingText = null) }
                        is ReplyProgress.Failed -> setState { copy(streamingText = null, error = progress.error) }
                    }
                }
            }
    }
}
