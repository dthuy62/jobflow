package me.dthuy.jobflow.domain.usecase

import me.dthuy.jobflow.domain.model.TaskDare
import me.dthuy.jobflow.domain.repository.TaskRepository

class AddTaskUseCase(private val repository: TaskRepository) {
    suspend operator fun invoke(task: TaskDare): Long {
        return repository.insertTask(task)
    }
}
