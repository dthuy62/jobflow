package com.example.domain.usecase

import com.example.domain.model.TaskDare
import com.example.domain.repository.TaskRepository

class AddTaskUseCase(private val repository: TaskRepository) {
    suspend operator fun invoke(task: TaskDare): Long {
        return repository.insertTask(task)
    }
}
