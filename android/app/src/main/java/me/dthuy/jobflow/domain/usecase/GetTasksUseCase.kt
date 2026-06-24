package me.dthuy.jobflow.domain.usecase

import me.dthuy.jobflow.domain.model.TaskDare
import me.dthuy.jobflow.domain.repository.TaskRepository
import kotlinx.coroutines.flow.Flow

class GetTasksUseCase(private val repository: TaskRepository) {
    operator fun invoke(): Flow<List<TaskDare>> = repository.getAllTasksFlow()
}
