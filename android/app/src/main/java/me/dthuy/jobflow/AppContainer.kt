package me.dthuy.jobflow

import android.content.Context
import me.dthuy.jobflow.data.database.AppDatabase
import me.dthuy.jobflow.data.repository.TaskRepositoryImpl
import me.dthuy.jobflow.domain.repository.TaskRepository
import me.dthuy.jobflow.domain.usecase.*

interface AppContainer {
    val taskRepository: TaskRepository
    val getTasksUseCase: GetTasksUseCase
    val addTaskUseCase: AddTaskUseCase
    val toggleCompleteTaskUseCase: ToggleCompleteTaskUseCase
    val deleteTaskUseCase: DeleteTaskUseCase
    val roastTaskUseCase: RoastTaskUseCase
}

class AppContainerImpl(private val context: Context) : AppContainer {
    private val database: AppDatabase by lazy {
        AppDatabase.getDatabase(context)
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
}
