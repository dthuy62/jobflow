package me.dthuy.jobflow.domain.usecase

import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import me.dthuy.jobflow.domain.model.ChatMessage
import me.dthuy.jobflow.domain.repository.ChatRepository

class ObserveMessagesUseCase @Inject constructor(private val repository: ChatRepository) {
    operator fun invoke(): Flow<List<ChatMessage>> = repository.observeMessages()
}
