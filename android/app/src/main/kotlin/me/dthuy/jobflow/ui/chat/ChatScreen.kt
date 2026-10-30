package me.dthuy.jobflow.ui.chat

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import me.dthuy.jobflow.R
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.mvi.CollectEffects
import me.dthuy.jobflow.domain.model.ChatRole
import me.dthuy.jobflow.ui.theme.Spacing

/** Stateful entry point: wires the ViewModel. Contains no layout. */
@Composable
fun ChatScreen(onOpenSettings: () -> Unit, viewModel: ChatViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()

    CollectEffects(viewModel.effects) { effect ->
        when (effect) {
            ChatEffect.NavigateToSettings -> onOpenSettings()
            ChatEffect.ScrollToBottom -> {
                val last = listState.layoutInfo.totalItemsCount - 1
                if (last >= 0) listState.animateScrollToItem(last)
            }
        }
    }

    ChatContent(state = state, onIntent = viewModel::onIntent, listState = listState)
}

/** Stateless: renders [state] and reports [onIntent]. Previewable and testable without Hilt. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatContent(
    state: ChatState,
    onIntent: (ChatIntent) -> Unit,
    listState: androidx.compose.foundation.lazy.LazyListState = rememberLazyListState(),
    modifier: Modifier = Modifier,
) {
    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.chat_title)) },
                actions = {
                    IconButton(onClick = { onIntent(ChatIntent.SettingsClicked) }) {
                        Icon(Icons.Default.Settings, contentDescription = stringResource(R.string.chat_open_settings))
                    }
                },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Box(Modifier.weight(1f).fillMaxWidth()) {
                if (state.messages.isEmpty() && !state.isStreaming) {
                    Text(
                        stringResource(R.string.chat_empty),
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.align(Alignment.Center).padding(Spacing.lg),
                    )
                }
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(Spacing.sm),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(Spacing.md),
                ) {
                    items(state.messages, key = { it.id }) { MessageBubble(it.role, it.text) }
                    state.streamingText?.let { text ->
                        item(key = "streaming") { MessageBubble(ChatRole.Assistant, text.ifEmpty { "…" }) }
                    }
                }
            }
            state.error?.let { ErrorBar(it, onDismiss = { onIntent(ChatIntent.ErrorDismissed) }) }
            InputBar(state, onIntent)
        }
    }
}

@Composable
private fun MessageBubble(role: ChatRole, text: String) {
    val isUser = role == ChatRole.User
    val colors = MaterialTheme.colorScheme
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = if (isUser) colors.primaryContainer else colors.surfaceVariant,
        ) {
            Text(text, Modifier.padding(Spacing.sm + Spacing.xs).widthIn(max = 280.dp))
        }
    }
}

@Composable
private fun ErrorBar(error: AppError, onDismiss: () -> Unit) {
    val message = stringResource(
        if (error is AppError.Network) R.string.chat_error_network else R.string.chat_error_generic,
    )
    Row(
        Modifier.fillMaxWidth().padding(horizontal = Spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(message, color = MaterialTheme.colorScheme.error, modifier = Modifier.weight(1f))
        TextButton(onClick = onDismiss) { Text(stringResource(R.string.chat_dismiss)) }
    }
}

@Composable
private fun InputBar(state: ChatState, onIntent: (ChatIntent) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(Spacing.md), verticalAlignment = Alignment.CenterVertically) {
        OutlinedTextField(
            value = state.input,
            onValueChange = { onIntent(ChatIntent.InputChanged(it)) },
            modifier = Modifier.weight(1f),
            placeholder = { Text(stringResource(R.string.chat_input_hint)) },
            maxLines = 4,
        )
        Spacer(Modifier.width(Spacing.sm))
        TextButton(onClick = { onIntent(ChatIntent.SendClicked) }, enabled = state.canSend) {
            Text(stringResource(R.string.chat_send))
        }
    }
}
