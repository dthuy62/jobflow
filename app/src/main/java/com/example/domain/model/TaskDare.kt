package com.example.domain.model

data class TaskDare(
    val id: Long = 0,
    val title: String,
    val description: String,
    val difficulty: Difficulty = Difficulty.MEDIUM,
    val timeLimitMinutes: Int = 30,
    val isCompleted: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val completedAt: Long? = null,
    val aiRealityCheck: String? = null,
    val isRoasting: Boolean = false,
    val scoreEarned: Int = 0
)
