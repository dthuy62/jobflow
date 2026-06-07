package com.example.presentation.screen.arena

import com.example.domain.model.Difficulty
import com.example.domain.model.TaskDare

// --- UI STATE ---
data class ArenaUiState(
    val tasks: List<TaskDare> = emptyList(),
    val titleInput: String = "",
    val descriptionInput: String = "",
    val difficultyInput: Difficulty = Difficulty.MEDIUM,
    val timeLimitInput: Int = 30,
    val isLoading: Boolean = false,
    val activeFilter: ArenaFilter = ArenaFilter.ALL,
    val totalXp: Int = 0,
    val isCreateSheetOpen: Boolean = false,
    val errorMessage: String? = null
)

enum class ArenaFilter {
    ALL,
    ACTIVE,
    COMPLETED
}

// --- USER INTENTS ---
sealed interface ArenaUiIntent {
    object LoadTasks : ArenaUiIntent
    data class AddTask(val title: String, val description: String, val difficulty: Difficulty, val timeLimitMinutes: Int) : ArenaUiIntent
    data class ToggleComplete(val task: TaskDare) : ArenaUiIntent
    data class DeleteTask(val id: Long) : ArenaUiIntent
    data class TriggerRoast(val task: TaskDare) : ArenaUiIntent
    
    // Form Inputs
    data class UpdateTitleInput(val title: String) : ArenaUiIntent
    data class UpdateDescInput(val desc: String) : ArenaUiIntent
    data class UpdateDifficultyInput(val diff: Difficulty) : ArenaUiIntent
    data class UpdateTimeInput(val mins: Int) : ArenaUiIntent
    data class UpdateFilter(val filter: ArenaFilter) : ArenaUiIntent
    data class ToggleCreateSheet(val isOpen: Boolean) : ArenaUiIntent
}

// --- ONE-SHOT SIDE EFFECTS ---
sealed interface ArenaUiEffect {
    data class ShowToast(val message: String) : ArenaUiEffect
    data class CelebrateXpGain(val xpGained: Int) : ArenaUiEffect
}
