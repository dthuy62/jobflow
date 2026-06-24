package me.dthuy.jobflow.presentation.screen.arena

import android.widget.Toast
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext

/**
 * Entry point for the Arena screen.
 *
 * Responsibilities are intentionally tiny:
 *  - subscribe to UI state,
 *  - relay one-shot side effects (toasts) to the platform,
 *  - delegate everything visual to [ArenaContent].
 *
 * All layout lives in [ArenaContent]; all logic lives in [ArenaViewModel].
 */
@Composable
fun ArenaScreen(
    viewModel: ArenaViewModel,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsState()
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        viewModel.effect.collect { effect ->
            when (effect) {
                is ArenaUiEffect.ShowToast ->
                    Toast.makeText(context, effect.message, Toast.LENGTH_SHORT).show()

                is ArenaUiEffect.CelebrateXpGain ->
                    Toast.makeText(
                        context,
                        "🏆 XP DARE CONQUERED! +${effect.xpGained} XP SECURED!",
                        Toast.LENGTH_LONG
                    ).show()
            }
        }
    }

    ArenaContent(
        state = state,
        onIntent = viewModel::handleIntent,
        modifier = modifier
    )
}
