package com.example.domain.usecase

import com.example.domain.model.Difficulty
import com.example.domain.model.TaskDare
import com.example.domain.repository.TaskRepository

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
