package me.dthuy.jobflow.domain.usecase

import me.dthuy.jobflow.domain.repository.TaskRepository

class DeleteTaskUseCase(private val repository: TaskRepository) {
    suspend operator fun invoke(id: Long) {
        repository.deleteTask(id)
    }
}
