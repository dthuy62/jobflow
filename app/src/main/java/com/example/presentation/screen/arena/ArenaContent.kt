package com.example.presentation.screen.arena

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.domain.model.Difficulty
import com.example.domain.model.TaskDare
import com.example.presentation.screen.arena.components.ArenaBody
import com.example.presentation.screen.arena.components.ArenaBottomBar
import com.example.presentation.screen.arena.components.ArenaFilterBar
import com.example.presentation.screen.arena.components.ArenaHeader
import com.example.ui.theme.MyApplicationTheme
import com.example.ui.theme.NeoBg

/**
 * Pure, state-driven layout for the Arena screen.
 *
 * The bottom panel (FAB / create form) lives in the Scaffold [Scaffold.bottomBar] slot rather than
 * floating on top of the content. This is what keeps the body correctly bounded: the empty-state
 * card is centered in the space *between* the filter bar and the bottom bar, instead of being
 * centered against the full screen height (which made it drift downward on tall devices).
 */
@Composable
fun ArenaContent(
    state: ArenaUiState,
    onIntent: (ArenaUiIntent) -> Unit,
    modifier: Modifier = Modifier
) {
    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = NeoBg,
        contentWindowInsets = WindowInsets.safeDrawing,
        bottomBar = {
            ArenaBottomBar(
                state = state,
                onIntent = onIntent,
                modifier = Modifier.padding(16.dp)
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
        ) {
            Spacer(Modifier.height(16.dp))

            ArenaHeader(totalXp = state.totalXp)

            Spacer(Modifier.height(16.dp))

            ArenaFilterBar(
                activeFilter = state.activeFilter,
                visibleCount = state.visibleTasks().size,
                onFilterSelected = { onIntent(ArenaUiIntent.UpdateFilter(it)) }
            )

            Spacer(Modifier.height(12.dp))

            ArenaBody(
                body = state.body(),
                onIntent = onIntent,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

// --- COMPOSE PREVIEWS ---

private val previewTasks = listOf(
    TaskDare(
        id = 1,
        title = "Write Authentication Logic",
        description = "Write security rules for Firestore databases and implement JWT decoding on custom backend endpoints.",
        difficulty = Difficulty.MEDIUM,
        timeLimitMinutes = 45,
        isCompleted = false,
        scoreEarned = 25,
        aiRealityCheck = "Honestly, utilizing basic JWT sounds legacy. WebAuthn or passkeys would raise your pre-seed valuation. 6/10 VC score."
    ),
    TaskDare(
        id = 2,
        title = "Deploy App to App Store",
        description = "Submit production build and pass Apple App Review team checks.",
        difficulty = Difficulty.HARD,
        timeLimitMinutes = 180,
        isCompleted = true,
        scoreEarned = 55,
        aiRealityCheck = "App Store launch completes the feedback loop. Smart hustle. 10/10 VC valuation."
    ),
    TaskDare(
        id = 3,
        title = "Fix CSS Flexbox Alignment",
        description = "Align icons inside button and fix wrap issues on small screens.",
        difficulty = Difficulty.EASY,
        timeLimitMinutes = 15,
        isCompleted = false,
        scoreEarned = 10,
        aiRealityCheck = null
    )
)

@Preview(showBackground = true)
@Composable
fun ArenaContentEmptyPreview() {
    MyApplicationTheme {
        ArenaContent(
            state = ArenaUiState(tasks = emptyList(), totalXp = 0, isCreateSheetOpen = false),
            onIntent = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
fun ArenaContentWithTasksPreview() {
    MyApplicationTheme {
        ArenaContent(
            state = ArenaUiState(tasks = previewTasks, totalXp = 55, isCreateSheetOpen = false),
            onIntent = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
fun ArenaContentCreateSheetOpenPreview() {
    MyApplicationTheme {
        ArenaContent(
            state = ArenaUiState(
                tasks = previewTasks,
                totalXp = 55,
                isCreateSheetOpen = true,
                titleInput = "Integrate WebSockets",
                descriptionInput = "Setup raw TCP gateway nodes for low latency chat streaming.",
                difficultyInput = Difficulty.NIGHTMARE,
                timeLimitInput = 120
            ),
            onIntent = {}
        )
    }
}
