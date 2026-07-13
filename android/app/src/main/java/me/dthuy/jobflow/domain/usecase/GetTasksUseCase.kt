package me.dthuy.jobflow.domain.usecase

import kotlinx.coroutines.flow.Flow
import me.dthuy.jobflow.domain.model.TaskDare
import me.dthuy.jobflow.domain.repository.TaskRepository

class GetTasksUseCase(
    private val repository: TaskRepository,
) {
    operator fun invoke(): Flow<List<TaskDare>> = repository.getAllTasksFlow()
}
