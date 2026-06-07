package com.example.domain.usecase

import com.example.domain.model.TaskDare
import com.example.domain.repository.TaskRepository

class RoastTaskUseCase(private val repository: TaskRepository) {
    suspend operator fun invoke(task: TaskDare) {
        // Step 1: Mark as actively roasting to animate UI stickers
        repository.updateTask(task.copy(isRoasting = true))

        // Step 2: Query the remote VC agency
        val roastText = repository.getAiRealityCheck(
            taskTitle = task.title,
            description = task.description,
            difficulty = task.difficulty.name
        )

        // Step 3: Fetch latest local representation to ensure safe integrity
        val currentTask = repository.getTaskById(task.id)
        if (currentTask != null) {
            repository.updateTask(
                currentTask.copy(
                    aiRealityCheck = roastText,
                    isRoasting = false
                )
            )
        }
    }
}
