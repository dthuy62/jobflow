package me.dthuy.jobflow.core.mvi

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Everything the screen needs to render. Immutable, one per screen. */
interface UiState

/** Everything the user (or system) can ask the screen to do. A sealed hierarchy per screen. */
interface UiIntent

/** One-shot events that must not be replayed on rotation: navigation, snackbar, scroll. */
interface UiEffect

/**
 * Unidirectional data flow base for screens with non-trivial state.
 *
 *   View --onIntent--> ViewModel --setState--> [state] --> View
 *                           \--sendEffect--> [effects] --> View (one-shot)
 *
 * Rules: the only public way in is [onIntent]; the only way to change state is [setState].
 */
abstract class MviViewModel<S : UiState, I : UiIntent, E : UiEffect>(initialState: S) : ViewModel() {
    private val _state = MutableStateFlow(initialState)
    val state: StateFlow<S> = _state.asStateFlow()

    private val _effects = Channel<E>(Channel.BUFFERED)
    val effects: Flow<E> = _effects.receiveAsFlow()

    fun onIntent(intent: I) = handleIntent(intent)

    protected abstract fun handleIntent(intent: I)

    protected fun setState(reduce: S.() -> S) = _state.update { it.reduce() }

    protected fun sendEffect(effect: E) {
        viewModelScope.launch { _effects.send(effect) }
    }
}
