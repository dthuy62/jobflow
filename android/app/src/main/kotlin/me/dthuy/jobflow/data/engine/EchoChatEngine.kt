package me.dthuy.jobflow.data.engine

import javax.inject.Inject
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import me.dthuy.jobflow.domain.engine.ChatEngine
import me.dthuy.jobflow.domain.model.ChatMessage

/**
 * Placeholder engine so the app runs end to end with no backend or model.
 * Replace by binding another [ChatEngine] in RepositoryModule: Gemini via Firebase AI Logic,
 * an on-device model (MediaPipe / llama.cpp), or your own API. No other file changes.
 */
class EchoChatEngine @Inject constructor() : ChatEngine {
    override fun streamReply(history: List<ChatMessage>): Flow<String> = flow {
        val last = history.lastOrNull()?.text.orEmpty()
        "You said: $last".split(" ").forEachIndexed { index, word ->
            delay(TOKEN_DELAY_MS)
            emit(if (index == 0) word else " $word")
        }
    }

    private companion object {
        const val TOKEN_DELAY_MS = 60L
    }
}
