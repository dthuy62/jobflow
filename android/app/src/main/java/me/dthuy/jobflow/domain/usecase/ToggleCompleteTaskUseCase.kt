package me.dthuy.jobflow.domain.usecase

import me.dthuy.jobflow.domain.model.Difficulty
import me.dthuy.jobflow.domain.model.TaskDare
import me.dthuy.jobflow.domain.repository.TaskRepository

class ToggleCompleteTaskUseCase(private val repository: TaskRepository) {
    suspend operator fun invoke(task: TaskDare) {
        val nextCompleted = !task.isCompleted
        val completedAt = if (nextCompleted) System.currentTimeMillis() else null
        val score = if (nextCompleted) {
            when (task.difficulty) {
                Difficulty.EASY -> 10
                Difficulty.MEDIUM -> 25
                Difficulty.HARD -> 55
                Difficulty.NIGHTMARE -> 110
            }
        } else {
            0
        }
        val updatedTask = task.copy(
            isCompleted = nextCompleted,
            completedAt = completedAt,
            scoreEarned = score
        )
        repository.updateTask(updatedTask)
    }
}
