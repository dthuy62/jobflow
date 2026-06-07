package com.example.domain.usecase

import com.example.domain.model.TaskDare
import com.example.domain.repository.TaskRepository
import kotlinx.coroutines.flow.Flow

class GetTasksUseCase(private val repository: TaskRepository) {
    operator fun invoke(): Flow<List<TaskDare>> = repository.getAllTasksFlow()
}
