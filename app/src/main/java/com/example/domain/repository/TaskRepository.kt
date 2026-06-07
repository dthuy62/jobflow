package com.example.domain.repository

import com.example.domain.model.TaskDare
import kotlinx.coroutines.flow.Flow

interface TaskRepository {
    fun getAllTasksFlow(): Flow<List<TaskDare>>
    suspend fun getTaskById(id: Long): TaskDare?
    suspend fun insertTask(task: TaskDare): Long
    suspend fun updateTask(task: TaskDare)
    suspend fun deleteTask(id: Long)
    suspend fun getAiRealityCheck(taskTitle: String, description: String, difficulty: String): String
}
