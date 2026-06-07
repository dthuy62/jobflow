package com.example.data.repository

import com.example.BuildConfig
import com.example.data.api.Content
import com.example.data.api.GenerateContentRequest
import com.example.data.api.Part
import com.example.data.api.RetrofitClient
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
        val apiKey = BuildConfig.GEMINI_API_KEY
        if (apiKey.isEmpty() || apiKey == "MY_GEMINI_API_KEY") {
            return "⚠️ AI Reality check offline. Add your GEMINI_API_KEY under the AI Studio Secrets tab to wake up the VC Roaster!"
        }

        val systemPrompt = "You are a hilarious, direct, and slightly cynical Silicon Valley venture capitalist. " +
                "Your job is to roast indie creators regarding their productivity tasks. " +
                "Be extremely direct, sarcastic, and funny. Limit your response to 2 highly engaging sentences, " +
                "and end with a predicted Completion Probability % (e.g., 'Completion Probability: 12%')."

        val userPrompt = """
            Evaluate this developer's dare:
            - Goal: "$taskTitle"
            - Specifics: "$description"
            - Stated Difficulty: $difficulty
            
            Give them an un-sugarcoated VC reality-check roast.
        """.trimIndent()

        val request = GenerateContentRequest(
            contents = listOf(Content(parts = listOf(Part(text = userPrompt)))),
            systemInstruction = Content(parts = listOf(Part(text = systemPrompt)))
        )

        return try {
            val response = RetrofitClient.service.generateContent(apiKey, request)
            response.candidates?.firstOrNull()?.content?.parts?.firstOrNull()?.text
                ?: "VC is busy reviewing pitch decks. Go build it yourself!"
        } catch (e: Exception) {
            "VC is offline: ${e.localizedMessage}. Build it anyway!"
        }
    }
}
