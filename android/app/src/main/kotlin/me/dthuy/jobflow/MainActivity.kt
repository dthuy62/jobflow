package me.dthuy.jobflow

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import dagger.hilt.android.AndroidEntryPoint
import me.dthuy.jobflow.navigation.AppNavigation
import me.dthuy.jobflow.ui.theme.AppTheme

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            // The soft palette is light-only for now; a theme choice returns with a dark palette.
            AppTheme(darkTheme = false) { AppNavigation() }
        }
    }
}
