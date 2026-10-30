package me.dthuy.jobflow.data.repository.impl

import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.Outcome
import me.dthuy.jobflow.core.common.map
import me.dthuy.jobflow.core.common.outcomeOf
import me.dthuy.jobflow.data.local.dao.ChatMessageDao
import me.dthuy.jobflow.data.local.entity.ChatMessageEntity
import me.dthuy.jobflow.domain.model.ChatMessage
import me.dthuy.jobflow.domain.model.ChatRole
import me.dthuy.jobflow.domain.repository.ChatRepository

class ChatRepositoryImpl @Inject constructor(private val dao: ChatMessageDao) : ChatRepository {
    override fun observeMessages(): Flow<List<ChatMessage>> =
        dao.observeAll().map { list -> list.map { it.toDomain() } }

    override suspend fun append(role: ChatRole, text: String): Outcome<Unit> =
        outcomeOf(onError = { AppError.Storage(it) }) {
            dao.insert(ChatMessageEntity(role = role.name, text = text, createdAtMillis = System.currentTimeMillis()))
        }.map { }
}

private fun ChatMessageEntity.toDomain() =
    ChatMessage(id = id, role = ChatRole.valueOf(role), text = text, createdAtMillis = createdAtMillis)
