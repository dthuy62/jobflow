package me.dthuy.jobflow.domain.repository

import kotlinx.coroutines.flow.Flow
import me.dthuy.jobflow.core.common.Outcome
import me.dthuy.jobflow.domain.model.ChatMessage
import me.dthuy.jobflow.domain.model.ChatRole

interface ChatRepository {
    fun observeMessages(): Flow<List<ChatMessage>>

    suspend fun append(role: ChatRole, text: String): Outcome<Unit>
}
