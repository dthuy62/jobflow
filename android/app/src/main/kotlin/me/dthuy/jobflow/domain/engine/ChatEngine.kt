package me.dthuy.jobflow.domain.engine

import kotlinx.coroutines.flow.Flow
import me.dthuy.jobflow.domain.model.ChatMessage

/**
 * Port for whatever produces the assistant reply (remote API, Gemini, or an on-device model).
 * Emits text deltas (tokens). The use case accumulates them; the engine never touches storage or UI.
 */
interface ChatEngine {
    fun streamReply(history: List<ChatMessage>): Flow<String>
}
