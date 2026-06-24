package me.dthuy.jobflow.presentation.screen.arena

import androidx.compose.ui.graphics.Color
import me.dthuy.jobflow.domain.model.Difficulty
import me.dthuy.jobflow.domain.model.TaskDare
import me.dthuy.jobflow.ui.theme.NeoGreen
import me.dthuy.jobflow.ui.theme.NeoMint
import me.dthuy.jobflow.ui.theme.NeoOrange
import me.dthuy.jobflow.ui.theme.NeoRed

/**
 * Derived UI models for the Arena screen.
 *
 * Instead of scattering booleans (isEmpty / isRoasting / aiRealityCheck != null) across the
 * composables, we map [ArenaUiState] into small, explicit "view states" here. Composables can
 * then branch with a single exhaustive `when`, which is far easier to read and test.
 */

/** Tasks that should be shown for the currently selected filter. */
fun ArenaUiState.visibleTasks(): List<TaskDare> = when (activeFilter) {
    ArenaFilter.ALL -> tasks
    ArenaFilter.ACTIVE -> tasks.filter { !it.isCompleted }
    ArenaFilter.COMPLETED -> tasks.filter { it.isCompleted }
}

/** What the main body of the screen should render. */
sealed interface ArenaBody {
    /** No tasks match the active filter -> show the "arena is barren" card. */
    data object Empty : ArenaBody

    /** There are tasks to show -> render the scrollable list. */
    data class Tasks(val tasks: List<TaskDare>) : ArenaBody
}

/** Maps the current state to the body that should be displayed. */
fun ArenaUiState.body(): ArenaBody {
    val visible = visibleTasks()
    return if (visible.isEmpty()) ArenaBody.Empty else ArenaBody.Tasks(visible)
}

/** State of the AI "VC roast" for a single task. */
sealed interface TaskRoast {
    /** The roast request is in flight. */
    data object InProgress : TaskRoast

    /** A roast verdict has been generated. */
    data class Available(val verdict: String) : TaskRoast

    /** No roast yet -> invite the user to request one. */
    data object NotRequested : TaskRoast
}

/** Maps a task to its roast view state. */
fun TaskDare.roastState(): TaskRoast {
    val verdict = aiRealityCheck
    return when {
        isRoasting -> TaskRoast.InProgress
        verdict != null -> TaskRoast.Available(verdict)
        else -> TaskRoast.NotRequested
    }
}

/** Accent color used to represent each difficulty level. */
fun Difficulty.accentColor(): Color = when (this) {
    Difficulty.EASY -> NeoGreen
    Difficulty.MEDIUM -> NeoMint
    Difficulty.HARD -> NeoOrange
    Difficulty.NIGHTMARE -> NeoRed
}
