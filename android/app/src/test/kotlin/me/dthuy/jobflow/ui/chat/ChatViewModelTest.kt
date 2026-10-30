package me.dthuy.jobflow.ui.chat

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.runTest
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.domain.usecase.ObserveMessagesUseCase
import me.dthuy.jobflow.domain.usecase.SendMessageUseCase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ChatViewModelTest {
    @get:Rule
    val mainRule = MainDispatcherRule()

    private val repository = FakeChatRepository()

    private fun viewModel(tokens: List<String> = listOf("Hi", " there")) = ChatViewModel(
        observeMessages = ObserveMessagesUseCase(repository),
        sendMessage = SendMessageUseCase(repository, FakeChatEngine(tokens), TestDispatchers(mainRule.dispatcher)),
    )

    @Test
    fun `send stores the user turn and the streamed assistant turn`() = runTest {
        val vm = viewModel()

        vm.onIntent(ChatIntent.InputChanged("hello"))
        vm.onIntent(ChatIntent.SendClicked)

        val state = vm.state.value
        assertEquals(listOf("hello", "Hi there"), state.messages.map { it.text })
        assertEquals("", state.input)
        assertNull(state.streamingText)
        assertNull(state.error)
    }

    @Test
    fun `blank input is ignored`() = runTest {
        val vm = viewModel()

        vm.onIntent(ChatIntent.InputChanged("   "))
        vm.onIntent(ChatIntent.SendClicked)

        assertTrue(vm.state.value.messages.isEmpty())
    }

    @Test
    fun `storage failure is surfaced as error and streaming stops`() = runTest {
        repository.failAppend = true
        val vm = viewModel()

        vm.onIntent(ChatIntent.InputChanged("hello"))
        vm.onIntent(ChatIntent.SendClicked)

        assertTrue(vm.state.value.error is AppError.Storage)
        assertNull(vm.state.value.streamingText)
    }

    @Test
    fun `dismissing the error clears it`() = runTest {
        repository.failAppend = true
        val vm = viewModel()
        vm.onIntent(ChatIntent.InputChanged("hello"))
        vm.onIntent(ChatIntent.SendClicked)

        vm.onIntent(ChatIntent.ErrorDismissed)

        assertNull(vm.state.value.error)
    }

    @Test
    fun `settings click emits a one-shot navigation effect`() = runTest {
        val vm = viewModel()
        val effects = mutableListOf<ChatEffect>()
        backgroundScope.launch(mainRule.dispatcher) { vm.effects.toList(effects) }

        vm.onIntent(ChatIntent.SettingsClicked)

        assertTrue(ChatEffect.NavigateToSettings in effects)
    }
}
