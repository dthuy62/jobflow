package me.dthuy.jobflow

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import me.dthuy.jobflow.presentation.screen.jobflow.CareerOpsShellScreen
import me.dthuy.jobflow.presentation.screen.jobflow.JobFlowShellViewModel
import me.dthuy.jobflow.presentation.screen.jobflow.JobFlowShellViewModelFactory
import me.dthuy.jobflow.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Retrieve our lazy dependency locator container
        val appContainer = (application as JobFlowApplication).container

        setContent {
            MyApplicationTheme {
                val shellViewModel: JobFlowShellViewModel =
                    viewModel(
                        factory = JobFlowShellViewModelFactory(appContainer.checkHealthUseCase),
                    )

                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    CareerOpsShellScreen(viewModel = shellViewModel)
                }
            }
        }
    }
}
