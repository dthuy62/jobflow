package me.dthuy.jobflow.presentation.screen.arena

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import me.dthuy.jobflow.domain.model.Difficulty
import me.dthuy.jobflow.domain.model.TaskDare
import me.dthuy.jobflow.domain.usecase.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class ArenaViewModel(
    private val getTasksUseCase: GetTasksUseCase,
    private val addTaskUseCase: AddTaskUseCase,
    private val toggleCompleteTaskUseCase: ToggleCompleteTaskUseCase,
    private val deleteTaskUseCase: DeleteTaskUseCase,
    private val roastTaskUseCase: RoastTaskUseCase
) : ViewModel() {

    private val _state = MutableStateFlow(ArenaUiState())
    val state: StateFlow<ArenaUiState> = _state.asStateFlow()

    private val _effect = MutableSharedFlow<ArenaUiEffect>()
    val effect: SharedFlow<ArenaUiEffect> = _effect.asSharedFlow()

    private var isCollectingTasks = false

    init {
        handleIntent(ArenaUiIntent.LoadTasks)
    }

    fun handleIntent(intent: ArenaUiIntent) {
        when (intent) {
            is ArenaUiIntent.LoadTasks -> loadTasks()
            is ArenaUiIntent.AddTask -> addTask(intent)
            is ArenaUiIntent.ToggleComplete -> toggleComplete(intent.task)
            is ArenaUiIntent.DeleteTask -> deleteTask(intent.id)
            is ArenaUiIntent.TriggerRoast -> triggerRoast(intent.task)
            is ArenaUiIntent.UpdateTitleInput -> updateTitleInput(intent.title)
            is ArenaUiIntent.UpdateDescInput -> updateDescInput(intent.desc)
            is ArenaUiIntent.UpdateDifficultyInput -> updateDifficultyInput(intent.diff)
            is ArenaUiIntent.UpdateTimeInput -> updateTimeInput(intent.mins)
            is ArenaUiIntent.UpdateFilter -> updateFilter(intent.filter)
            is ArenaUiIntent.ToggleCreateSheet -> toggleCreateSheet(intent.isOpen)
        }
    }

    private fun loadTasks() {
        if (isCollectingTasks) return
        isCollectingTasks = true
        _state.update { it.copy(isLoading = true) }
        viewModelScope.launch {
            try {
                getTasksUseCase().collect { tasksList ->
                    val completedXp = tasksList.filter { it.isCompleted }.sumOf { it.scoreEarned }
                    _state.update {
                        it.copy(
                            tasks = tasksList,
                            totalXp = completedXp,
                            isLoading = false
                        )
                    }
                }
            } catch (e: Exception) {
                _state.update {
                    it.copy(
                        errorMessage = "Error loading arena tasks: ${e.localizedMessage}",
                        isLoading = false
                    )
                }
            }
        }
    }

    private fun addTask(intent: ArenaUiIntent.AddTask) {
        if (intent.title.isBlank()) {
            emitToast("Task title cannot be blank!")
            return
        }
        viewModelScope.launch {
            try {
                val newTask = TaskDare(
                    title = intent.title.trim(),
                    description = intent.description.trim(),
                    difficulty = intent.difficulty,
                    timeLimitMinutes = intent.timeLimitMinutes
                )
                // Insert task into Room local database
                val taskId = addTaskUseCase(newTask)
                val persistedTask = newTask.copy(id = taskId)

                // Clean inputs and collapse modal
                _state.update {
                    it.copy(
                        titleInput = "",
                        descriptionInput = "",
                        difficultyInput = Difficulty.MEDIUM,
                        timeLimitInput = 30,
                        isCreateSheetOpen = false
                    )
                }
                emitToast("Challenge Created!")

                // Seamlessly trigger AI analysis in the background Coroutine
                launch {
                    roastTaskUseCase(persistedTask)
                }
            } catch (e: Exception) {
                emitToast("Failed to create challenge: ${e.localizedMessage}")
            }
        }
    }

    private fun toggleComplete(task: TaskDare) {
        viewModelScope.launch {
            try {
                val willBeCompleted = !task.isCompleted
                toggleCompleteTaskUseCase(task)

                if (willBeCompleted) {
                    val pointsGained = when (task.difficulty) {
                        Difficulty.EASY -> 10
                        Difficulty.MEDIUM -> 25
                        Difficulty.HARD -> 55
                        Difficulty.NIGHTMARE -> 110
                    }
                    _effect.emit(ArenaUiEffect.CelebrateXpGain(pointsGained))
                } else {
                    emitToast("Undid completion!")
                }
            } catch (e: Exception) {
                emitToast("Error updating task: ${e.localizedMessage}")
            }
        }
    }

    private fun deleteTask(id: Long) {
        viewModelScope.launch {
            try {
                deleteTaskUseCase(id)
                emitToast("Challenge deleted!")
            } catch (e: Exception) {
                emitToast("Failed to delete challenge: ${e.localizedMessage}")
            }
        }
    }

    private fun triggerRoast(task: TaskDare) {
        if (task.isRoasting) return
        viewModelScope.launch {
            try {
                emitToast("Hailing venture capitalist for roast...")
                roastTaskUseCase(task)
            } catch (e: Exception) {
                emitToast("Pitch Roast failed: ${e.localizedMessage}")
            }
        }
    }

    // --- Inputs Mutators ---

    private fun updateTitleInput(title: String) {
        _state.update { it.copy(titleInput = title) }
    }

    private fun updateDescInput(desc: String) {
        _state.update { it.copy(descriptionInput = desc) }
    }

    private fun updateDifficultyInput(diff: Difficulty) {
        _state.update { it.copy(difficultyInput = diff) }
    }

    private fun updateTimeInput(mins: Int) {
        // Enforce boundary caps
        val clampedMins = mins.coerceIn(5, 480)
        _state.update { it.copy(timeLimitInput = clampedMins) }
    }

    private fun updateFilter(filter: ArenaFilter) {
        _state.update { it.copy(activeFilter = filter) }
    }

    private fun toggleCreateSheet(isOpen: Boolean) {
        _state.update { it.copy(isCreateSheetOpen = isOpen) }
    }

    private fun emitToast(msg: String) {
        viewModelScope.launch {
            _effect.emit(ArenaUiEffect.ShowToast(msg))
        }
    }
}

// --- VIEWMODEL FACTORY ---
class ArenaViewModelFactory(
    private val getTasksUseCase: GetTasksUseCase,
    private val addTaskUseCase: AddTaskUseCase,
    private val toggleCompleteTaskUseCase: ToggleCompleteTaskUseCase,
    private val deleteTaskUseCase: DeleteTaskUseCase,
    private val roastTaskUseCase: RoastTaskUseCase
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(ArenaViewModel::class.java)) {
            return ArenaViewModel(
                getTasksUseCase,
                addTaskUseCase,
                toggleCompleteTaskUseCase,
                deleteTaskUseCase,
                roastTaskUseCase
            ) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}
