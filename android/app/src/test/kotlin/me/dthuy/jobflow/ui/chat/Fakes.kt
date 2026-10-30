package me.dthuy.jobflow.ui.chat

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.DispatcherProvider
import me.dthuy.jobflow.core.common.Outcome
import me.dthuy.jobflow.domain.engine.ChatEngine
import me.dthuy.jobflow.domain.model.ChatMessage
import me.dthuy.jobflow.domain.model.ChatRole
import me.dthuy.jobflow.domain.repository.ChatRepository
import org.junit.rules.TestWatcher
import org.junit.runner.Description

/** Fakes beat mocks here: they are real implementations of the domain ports, so tests read like usage. */
class FakeChatRepository : ChatRepository {
    private val messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    var failAppend = false

    override fun observeMessages(): Flow<List<ChatMessage>> = messages

    override suspend fun append(role: ChatRole, text: String): Outcome<Unit> {
        if (failAppend) return Outcome.Failure(AppError.Storage())
        messages.value += ChatMessage(id = messages.value.size + 1L, role = role, text = text, createdAtMillis = 0L)
        return Outcome.Success(Unit)
    }
}

class FakeChatEngine(private val tokens: List<String>) : ChatEngine {
    override fun streamReply(history: List<ChatMessage>): Flow<String> = flowOf(*tokens.toTypedArray())
}

class TestDispatchers(dispatcher: CoroutineDispatcher) : DispatcherProvider {
    override val main = dispatcher
    override val default = dispatcher
    override val io = dispatcher
}

@OptIn(ExperimentalCoroutinesApi::class)
class MainDispatcherRule(val dispatcher: TestDispatcher = UnconfinedTestDispatcher()) : TestWatcher() {
    override fun starting(description: Description) = Dispatchers.setMain(dispatcher)

    override fun finished(description: Description) = Dispatchers.resetMain()
}
