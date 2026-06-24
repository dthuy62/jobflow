package me.dthuy.jobflow.data.database

import androidx.room.Entity
import androidx.room.PrimaryKey
import me.dthuy.jobflow.domain.model.Difficulty
import me.dthuy.jobflow.domain.model.TaskDare

@Entity(tableName = "task_dares")
data class TaskEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val description: String,
    val difficulty: String,
    val timeLimitMinutes: Int,
    val isCompleted: Boolean,
    val createdAt: Long,
    val completedAt: Long?,
    val aiRealityCheck: String?,
    val scoreEarned: Int
) {
    fun toDomain(): TaskDare {
        return TaskDare(
            id = id,
            title = title,
            description = description,
            difficulty = try { Difficulty.valueOf(difficulty) } catch (e: Exception) { Difficulty.MEDIUM },
            timeLimitMinutes = timeLimitMinutes,
            isCompleted = isCompleted,
            createdAt = createdAt,
            completedAt = completedAt,
            aiRealityCheck = aiRealityCheck,
            isRoasting = false,
            scoreEarned = scoreEarned
        )
    }

    companion object {
        fun fromDomain(domain: TaskDare): TaskEntity {
            return TaskEntity(
                id = domain.id,
                title = domain.title,
                description = domain.description,
                difficulty = domain.difficulty.name,
                timeLimitMinutes = domain.timeLimitMinutes,
                isCompleted = domain.isCompleted,
                createdAt = domain.createdAt,
                completedAt = domain.completedAt,
                aiRealityCheck = domain.aiRealityCheck,
                scoreEarned = domain.scoreEarned
            )
        }
    }
}
