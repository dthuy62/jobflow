package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.presentation.screen.arena.ArenaScreen
import com.example.presentation.screen.arena.ArenaViewModel
import com.example.presentation.screen.arena.ArenaViewModelFactory
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        
        // Retrieve our lazy dependency locator container
        val appContainer = (application as TaskArenaApplication).container

        setContent {
            MyApplicationTheme {
                // Launch our MVI viewmodel initialized with pure decoupler usecases
                val arenaViewModel: ArenaViewModel = viewModel(
                    factory = ArenaViewModelFactory(
                        getTasksUseCase = appContainer.getTasksUseCase,
                        addTaskUseCase = appContainer.addTaskUseCase,
                        toggleCompleteTaskUseCase = appContainer.toggleCompleteTaskUseCase,
                        deleteTaskUseCase = appContainer.deleteTaskUseCase,
                        roastTaskUseCase = appContainer.roastTaskUseCase
                    )
                )

                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    ArenaScreen(viewModel = arenaViewModel)
                }
            }
        }
    }
}
