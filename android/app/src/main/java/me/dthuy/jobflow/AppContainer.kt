package me.dthuy.jobflow

import android.content.Context
import me.dthuy.jobflow.data.database.JobFlowDatabase
import me.dthuy.jobflow.data.datasource.JobFlowDatabaseDataSource
import me.dthuy.jobflow.data.datasource.JobFlowNetworkDataSource
import me.dthuy.jobflow.data.remote.JobFlowApiClient
import me.dthuy.jobflow.data.remote.JobFlowApiService
import me.dthuy.jobflow.data.repository.JobFlowRepositoryImpl
import me.dthuy.jobflow.data.repository.TaskRepositoryImpl
import me.dthuy.jobflow.domain.repository.JobFlowRepository
import me.dthuy.jobflow.domain.repository.TaskRepository
import me.dthuy.jobflow.domain.usecase.*

interface AppContainer {
    val taskRepository: TaskRepository
    val getTasksUseCase: GetTasksUseCase
    val addTaskUseCase: AddTaskUseCase
    val toggleCompleteTaskUseCase: ToggleCompleteTaskUseCase
    val deleteTaskUseCase: DeleteTaskUseCase
    val roastTaskUseCase: RoastTaskUseCase
    val jobFlowRepository: JobFlowRepository
    val jobFlowApiClient: JobFlowApiService
}

class AppContainerImpl(private val context: Context) : AppContainer {
    private val database: JobFlowDatabase by lazy {
        JobFlowDatabase.getDatabase(context)
    }
    private val apiClient: JobFlowApiService by lazy {
        JobFlowApiClient.create(BuildConfig.CAREER_OPS_DEFAULT_BASE_URL, null)
    }

    private val networkDataSource by lazy {
        JobFlowNetworkDataSource(apiClient)
    }

    private val databaseDataSource by lazy {
        JobFlowDatabaseDataSource(database)
    }

    override val taskRepository: TaskRepository by lazy {
        TaskRepositoryImpl(database.taskDao())
    }

    override val getTasksUseCase: GetTasksUseCase by lazy {
        GetTasksUseCase(taskRepository)
    }

    override val addTaskUseCase: AddTaskUseCase by lazy {
        AddTaskUseCase(taskRepository)
    }

    override val toggleCompleteTaskUseCase: ToggleCompleteTaskUseCase by lazy {
        ToggleCompleteTaskUseCase(taskRepository)
    }

    override val deleteTaskUseCase: DeleteTaskUseCase by lazy {
        DeleteTaskUseCase(taskRepository)
    }

    override val roastTaskUseCase: RoastTaskUseCase by lazy {
        RoastTaskUseCase(taskRepository)
    }
    override val jobFlowRepository: JobFlowRepository by lazy {
        JobFlowRepositoryImpl(
            networkDataSource,
            databaseDataSource
        )
    }

    override val jobFlowApiClient: JobFlowApiService
            by lazy { apiClient }
}
