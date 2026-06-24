package me.dthuy.jobflow.presentation.screen.arena.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.dthuy.jobflow.domain.model.TaskDare
import me.dthuy.jobflow.presentation.component.NeoButton
import me.dthuy.jobflow.presentation.component.NeoCard
import me.dthuy.jobflow.presentation.screen.arena.ArenaBody as ArenaBodyState
import me.dthuy.jobflow.presentation.screen.arena.ArenaUiIntent
import me.dthuy.jobflow.ui.theme.NeoBlack
import me.dthuy.jobflow.ui.theme.NeoWhite
import me.dthuy.jobflow.ui.theme.NeoYellow

@Composable
fun ArenaBody(
    body: ArenaBodyState,
    onIntent: (ArenaUiIntent) -> Unit,
    modifier: Modifier = Modifier
) {
    when (body) {
        is ArenaBodyState.Empty -> EmptyArena(
            onCreateClick = { onIntent(ArenaUiIntent.ToggleCreateSheet(true)) },
            modifier = modifier
        )

        is ArenaBodyState.Tasks -> TaskList(
            tasks = body.tasks,
            onIntent = onIntent,
            modifier = modifier
        )
    }
}

@Composable
private fun EmptyArena(onCreateClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        NeoCard(
            backgroundColor = NeoWhite,
            shadowOffset = 4.dp,
            shape = RoundedCornerShape(20.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("ಠ_ಠ", fontSize = 48.sp, fontWeight = FontWeight.ExtraBold, color = NeoBlack)
                Text(
                    "THE ARENA IS BARREN",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = NeoBlack
                )
                Text(
                    "The AI Venture Capitalists are getting bored. Add a software challenge below to roast and complete!",
                    fontSize = 12.sp, color = Color.DarkGray, fontWeight = FontWeight.Medium,
                    textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 16.dp)
                )
                NeoButton(
                    onClick = onCreateClick,
                    backgroundColor = NeoYellow,
                    modifier = Modifier.width(200.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Add")
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "CREATE CHALLENGE",
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun TaskList(
    tasks: List<TaskDare>,
    onIntent: (ArenaUiIntent) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(top = 4.dp, bottom = 4.dp)
    ) {
        items(tasks, key = { it.id }) { task ->
            TaskItemCard(
                task = task,
                onCheckedChange = { onIntent(ArenaUiIntent.ToggleComplete(task)) },
                onDelete = { onIntent(ArenaUiIntent.DeleteTask(task.id)) },
                onRetryRoast = { onIntent(ArenaUiIntent.TriggerRoast(task)) }
            )
        }
    }
}
