package com.example.data.repository

import com.example.data.database.TaskDao
import com.example.data.database.TaskEntity
import com.example.domain.model.TaskDare
import com.example.domain.repository.TaskRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class TaskRepositoryImpl(
    private val taskDao: TaskDao
) : TaskRepository {

    override fun getAllTasksFlow(): Flow<List<TaskDare>> {
        return taskDao.getAllTasksFlow().map { entities ->
            entities.map { it.toDomain() }
        }
    }

    override suspend fun getTaskById(id: Long): TaskDare? {
        return taskDao.getTaskById(id)?.toDomain()
    }

    override suspend fun insertTask(task: TaskDare): Long {
        return taskDao.insertTask(TaskEntity.fromDomain(task))
    }

    override suspend fun updateTask(task: TaskDare) {
        taskDao.updateTask(TaskEntity.fromDomain(task))
    }

    override suspend fun deleteTask(id: Long) {
        taskDao.deleteTask(id)
    }

    override suspend fun getAiRealityCheck(
        taskTitle: String,
        description: String,
        difficulty: String
    ): String {
        val effortSignal = when (difficulty) {
            "EASY" -> "low-friction"
            "MEDIUM" -> "focused"
            "HARD" -> "serious"
            "NIGHTMARE" -> "high-risk"
            else -> "unknown-risk"
        }
        val detailSignal = if (description.isBlank()) {
            "No details yet"
        } else {
            "${description.trim().take(72)}${if (description.length > 72) "..." else ""}"
        }

        return "Offline reality check: \"$taskTitle\" looks $effortSignal. $detailSignal. Completion Probability: ${completionProbability(difficulty)}%."
    }

    private fun completionProbability(difficulty: String): Int = when (difficulty) {
        "EASY" -> 82
        "MEDIUM" -> 64
        "HARD" -> 41
        "NIGHTMARE" -> 18
        else -> 50
    }
}
