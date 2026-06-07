package com.example.presentation.screen.arena

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.domain.model.Difficulty
import com.example.domain.model.TaskDare
import com.example.presentation.component.*
import com.example.ui.theme.*

@Composable
fun ArenaScreen(
    viewModel: ArenaViewModel,
    modifier: Modifier = Modifier
) {
    val state by viewModel.collectAsState()
    val context = LocalContext.current

    // Observe unidirectional hot side effects
    LaunchedEffect(key1 = true) {
        viewModel.effect.collect { effect ->
            when (effect) {
                is ArenaUiEffect.ShowToast -> {
                    Toast.makeText(context, effect.message, Toast.LENGTH_SHORT).show()
                }
                is ArenaUiEffect.CelebrateXpGain -> {
                    Toast.makeText(
                        context,
                        "🏆 XP DARE CONQUERED! +${effect.xpGained} XP SECURED!",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        contentWindowInsets = WindowInsets.safeDrawing,
        containerColor = NeoBg
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp)
            ) {
                Spacer(modifier = Modifier.height(16.dp))

                // --- HEADER HERO WIDGET ---
                NeoCard(
                    backgroundColor = NeoYellow,
                    shadowColor = NeoBlack,
                    shadowOffset = 6.dp
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "TASK ARENA",
                                fontSize = 28.sp,
                                fontWeight = FontWeight.ExtraBold,
                                fontFamily = FontFamily.SansSerif,
                                color = NeoBlack
                            )
                            Text(
                                text = "DEFEAT PROCRASTINATION • PLAY HARD",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace,
                                color = NeoBlack
                            )
                        }

                        // Giant XP Tracker Bubble
                        Box(
                            modifier = Modifier
                                .background(NeoBlack, shape = RectangleShape)
                                .border(2.dp, NeoWhite, shape = RectangleShape)
                                .padding(horizontal = 12.dp, vertical = 6.dp)
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "${state.totalXp} XP",
                                    color = NeoWhite,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontFamily = FontFamily.Monospace
                                )
                                Text(
                                    text = "EARNED",
                                    color = NeoYellow,
                                    fontSize = 8.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // --- CONTROLS: FILTERS & STATISTICS BAR ---
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Filter row
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        ArenaFilter.values().forEach { filter ->
                            val isSelected = state.activeFilter == filter
                            val buttonColor = if (isSelected) NeoGreen else NeoWhite
                            
                            Box(
                                modifier = Modifier
                                    .background(buttonColor, shape = RectangleShape)
                                    .border(2.dp, NeoBlack, shape = RectangleShape)
                                    .clickable { viewModel.handleIntent(ArenaUiIntent.UpdateFilter(filter)) }
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = filter.name,
                                    color = NeoBlack,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }

                    // Count Badge
                    val filteredCount = when (state.activeFilter) {
                        ArenaFilter.ALL -> state.tasks.size
                        ArenaFilter.ACTIVE -> state.tasks.count { !it.isCompleted }
                        ArenaFilter.COMPLETED -> state.tasks.count { it.isCompleted }
                    }
                    NeoBadge(
                        text = "DARES: $filteredCount",
                        backgroundColor = NeoPink
                    )
                }

                Spacer(modifier = Modifier.height(12.dp))

                // --- MAIN LIST / SCROLLER CARD ---
                val listTasks = when (state.activeFilter) {
                    ArenaFilter.ALL -> state.tasks
                    ArenaFilter.ACTIVE -> state.tasks.filter { !it.isCompleted }
                    ArenaFilter.COMPLETED -> state.tasks.filter { it.isCompleted }
                }

                if (listTasks.isEmpty()) {
                    // Visually arresting Retro Brutalist Empty State
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        NeoCard(
                            backgroundColor = NeoWhite,
                            shadowOffset = 4.dp
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Text(
                                    text = "ಠ_ಠ",
                                    fontSize = 48.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = NeoBlack
                                )
                                Text(
                                    text = "THE ARENA IS BARREN",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace,
                                    color = NeoBlack
                                )
                                Text(
                                    text = "The AI Venture Capitalists are getting bored. Add a software challenge below to roast and complete!",
                                    fontSize = 12.sp,
                                    color = Color.DarkGray,
                                    fontWeight = FontWeight.Medium,
                                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                    modifier = Modifier.padding(horizontal = 16.dp)
                                )
                                
                                NeoButton(
                                    onClick = { viewModel.handleIntent(ArenaUiIntent.ToggleCreateSheet(true)) },
                                    backgroundColor = NeoYellow,
                                    modifier = Modifier.width(200.dp)
                                ) {
                                    Icon(Icons.Default.Add, contentDescription = "Add")
                                    Spacer(modifier = Modifier.width(6.dp))
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
                } else {
                    LazyColumn(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(16.dp),
                        contentPadding = PaddingValues(bottom = 120.dp, top = 4.dp)
                    ) {
                        items(listTasks, key = { it.id }) { task ->
                            TaskItemCard(
                                task = task,
                                onCheckedChange = { viewModel.handleIntent(ArenaUiIntent.ToggleComplete(task)) },
                                onDelete = { viewModel.handleIntent(ArenaUiIntent.DeleteTask(task.id)) },
                                onRetryRoast = { viewModel.handleIntent(ArenaUiIntent.TriggerRoast(task)) }
                            )
                        }
                    }
                }
            }

            // --- BOTTOM DRAWER / FLOATING LAB PANEL ---
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(16.dp)
            ) {
                if (!state.isCreateSheetOpen) {
                    // Floating Action Button
                    NeoButton(
                        onClick = { viewModel.handleIntent(ArenaUiIntent.ToggleCreateSheet(true)) },
                        backgroundColor = NeoOrange,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(imageVector = Icons.Default.Add, contentDescription = "New Call", tint = NeoBlack)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "PITCH NEW CHALLENGE",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.ExtraBold,
                            fontFamily = FontFamily.Monospace,
                            color = NeoBlack
                        )
                    }
                } else {
                    // Full creation form
                    NeoCard(
                        backgroundColor = NeoWhite,
                        shadowOffset = 8.dp,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        modifier = Modifier
                                            .size(12.dp)
                                            .background(NeoRed, shape = RectangleShape)
                                            .border(1.5.dp, NeoBlack, shape = RectangleShape)
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text(
                                        text = "CHALLENGE GENERATOR LAB",
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 14.sp,
                                        fontFamily = FontFamily.Monospace
                                    )
                                }

                                // Close Icon Block
                                Box(
                                    modifier = Modifier
                                        .background(NeoWhite, shape = CircleShape)
                                        .border(2.dp, NeoBlack, shape = CircleShape)
                                        .clickable { viewModel.handleIntent(ArenaUiIntent.ToggleCreateSheet(false)) }
                                        .padding(4.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "Close",
                                        modifier = Modifier.size(14.dp),
                                        tint = NeoBlack
                                    )
                                }
                            }

                            Divider(color = NeoBlack, thickness = 2.dp)

                            NeoTextField(
                                value = state.titleInput,
                                onValueChange = { viewModel.handleIntent(ArenaUiIntent.UpdateTitleInput(it)) },
                                placeholder = "E.g., Write Auth Integration Tests",
                                label = "Task Title"
                            )

                            NeoTextField(
                                value = state.descriptionInput,
                                onValueChange = { viewModel.handleIntent(ArenaUiIntent.UpdateDescInput(it)) },
                                placeholder = "Details of what is being built...",
                                label = "Specification specifics",
                                singleLine = false
                            )

                            // Gamified custom selectors
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                // Difficulty Column
                                Column(modifier = Modifier.weight(1f)) {
                                    Box(
                                        modifier = Modifier
                                            .background(NeoPurple, shape = RectangleShape)
                                            .border(1.5.dp, NeoBlack, shape = RectangleShape)
                                            .padding(horizontal = 8.dp, vertical = 2.dp)
                                    ) {
                                        Text(
                                            "DIFFICULTY LEVEL",
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    
                                    var expandedDiff by remember { mutableStateOf(false) }
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .background(NeoWhite, shape = RectangleShape)
                                            .border(2.5.dp, NeoBlack, shape = RectangleShape)
                                            .clickable { expandedDiff = true }
                                            .padding(10.dp)
                                    ) {
                                        Text(
                                            text = state.difficultyInput.name,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            fontFamily = FontFamily.Monospace
                                        )
                                        DropdownMenu(
                                            expanded = expandedDiff,
                                            onDismissRequest = { expandedDiff = false },
                                            modifier = Modifier.background(NeoWhite).border(2.dp, NeoBlack)
                                        ) {
                                            Difficulty.values().forEach { d ->
                                                DropdownMenuItem(
                                                    text = { Text(d.name, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace) },
                                                    onClick = {
                                                        viewModel.handleIntent(ArenaUiIntent.UpdateDifficultyInput(d))
                                                        expandedDiff = false
                                                    }
                                                )
                                            }
                                        }
                                    }
                                }

                                // Time Limit Column
                                Column(modifier = Modifier.weight(1f)) {
                                    Box(
                                        modifier = Modifier
                                            .background(NeoGreen, shape = RectangleShape)
                                            .border(1.5.dp, NeoBlack, shape = RectangleShape)
                                            .padding(horizontal = 8.dp, vertical = 2.dp)
                                    ) {
                                        Text(
                                            "LIMIT MINUTES",
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                    Spacer(modifier = Modifier.height(4.dp))
                                    
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .background(NeoWhite, shape = RectangleShape)
                                            .border(2.5.dp, NeoBlack, shape = RectangleShape)
                                            .padding(2.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        // Minus Button
                                        Box(
                                            modifier = Modifier
                                                .background(NeoBg, shape = RectangleShape)
                                                .border(1.5.dp, NeoBlack, shape = RectangleShape)
                                                .clickable { viewModel.handleIntent(ArenaUiIntent.UpdateTimeInput(state.timeLimitInput - 5)) }
                                                .padding(horizontal = 8.dp, vertical = 4.dp)
                                        ) {
                                            Text("-", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                        }

                                        Text(
                                            text = "${state.timeLimitInput}m",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 12.sp,
                                            fontFamily = FontFamily.Monospace
                                        )

                                        // Plus Button
                                        Box(
                                            modifier = Modifier
                                                .background(NeoBg, shape = RectangleShape)
                                                .border(1.5.dp, NeoBlack, shape = RectangleShape)
                                                .clickable { viewModel.handleIntent(ArenaUiIntent.UpdateTimeInput(state.timeLimitInput + 5)) }
                                                .padding(horizontal = 8.dp, vertical = 4.dp)
                                        ) {
                                            Text("+", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(6.dp))

                            NeoButton(
                                onClick = {
                                    viewModel.handleIntent(
                                        ArenaUiIntent.AddTask(
                                            title = state.titleInput,
                                            description = state.descriptionInput,
                                            difficulty = state.difficultyInput,
                                            timeLimitMinutes = state.timeLimitInput
                                        )
                                    )
                                },
                                backgroundColor = NeoYellow
                            ) {
                                Text(
                                    "LAUNCH TO THE ARENA",
                                    fontWeight = FontWeight.ExtraBold,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TaskItemCard(
    task: TaskDare,
    onCheckedChange: () -> Unit,
    onDelete: () -> Unit,
    onRetryRoast: () -> Unit
) {
    val difficultyColor = when (task.difficulty) {
        Difficulty.EASY -> NeoGreen
        Difficulty.MEDIUM -> NeoMint
        Difficulty.HARD -> NeoOrange
        Difficulty.NIGHTMARE -> NeoRed
    }

    NeoCard(
        backgroundColor = if (task.isCompleted) Color(0xFFE2E2E2) else NeoWhite,
        shadowOffset = 4.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Task Header Line
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Dynamic Brutalist Checkbox
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .background(if (task.isCompleted) NeoGreen else NeoWhite, shape = RectangleShape)
                            .border(2.5.dp, NeoBlack, shape = RectangleShape)
                            .clickable { onCheckedChange() },
                        contentAlignment = Alignment.Center
                    ) {
                        if (task.isCompleted) {
                            Text(
                                "✓",
                                color = NeoBlack,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }
                    Spacer(modifier = Modifier.width(10.dp))

                    Text(
                        text = task.title,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = if (task.isCompleted) Color.Gray else NeoBlack,
                        textDecoration = if (task.isCompleted) TextDecoration.LineThrough else null,
                        modifier = Modifier.padding(end = 8.dp)
                    )
                }

                // Delete Action Block (represented with a brutalist square)
                Box(
                    modifier = Modifier
                        .background(NeoRed, shape = RectangleShape)
                        .border(1.5.dp, NeoBlack, shape = RectangleShape)
                        .clickable { onDelete() }
                        .padding(4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Delete",
                        modifier = Modifier.size(14.dp),
                        tint = NeoBlack
                    )
                }
            }

            // Description text
            if (task.description.isNotBlank()) {
                Text(
                    text = task.description,
                    fontSize = 12.sp,
                    color = if (task.isCompleted) Color.Gray else Color.DarkGray,
                    fontWeight = FontWeight.Medium
                )
            }

            // Badges row
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                NeoBadge(
                    text = task.difficulty.name,
                    backgroundColor = difficultyColor
                )

                NeoBadge(
                    text = "⏱️ ${task.timeLimitMinutes}M",
                    backgroundColor = NeoBlue
                )

                if (task.isCompleted) {
                    NeoBadge(
                        text = "+${task.scoreEarned} XP",
                        backgroundColor = NeoPink
                    )
                }
            }

            // Division Line
            Divider(color = NeoBlack, thickness = 1.5.dp)

            // --- VC AI ROAST BUBBLE ---
            if (task.isRoasting) {
                // Cool minimal loading line
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(NeoLightGray, shape = RectangleShape)
                        .border(1.5.dp, NeoBlack, shape = RectangleShape)
                        .padding(8.dp)
                ) {
                    CircularProgressIndicator(
                        color = NeoBlack,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(12.dp)
                    )
                    Text(
                        "HAILING VC SPARK AI INVESTMENT DEPT FOR EVALUATION...",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        color = NeoBlack
                    )
                }
            } else if (task.aiRealityCheck != null) {
                // Speech bubble setup
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFFFF2D4), shape = RectangleShape) // Light warm retro yellow
                        .border(2.dp, NeoBlack, shape = RectangleShape)
                        .padding(10.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = "VC",
                                tint = NeoYellow,
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                "AI VENTURE CAPITALIST BOARD:",
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace,
                                color = NeoBlack
                            )
                        }

                        // Retry Mini-Link
                        Box(
                            modifier = Modifier
                                .background(NeoWhite, shape = RectangleShape)
                                .border(1.dp, NeoBlack, shape = RectangleShape)
                                .clickable { onRetryRoast() }
                                .padding(horizontal = 4.dp, vertical = 2.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "Retry",
                                modifier = Modifier.size(10.dp),
                                tint = NeoBlack
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = task.aiRealityCheck,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = NeoBlack,
                        lineHeight = 14.sp
                    )
                }
            } else {
                // If AI is empty, prompt them to get a roast
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(NeoWhite, shape = RectangleShape)
                        .border(1.5.dp, NeoBlack, shape = RectangleShape)
                        .clickable { onRetryRoast() }
                        .padding(8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "⚡ GET AI VC REALITY CHECK ROAST",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.ExtraBold,
                        fontFamily = FontFamily.Monospace,
                        color = NeoBlack
                    )
                }
            }
        }
    }
}

// Helper colors for local items
private val NeoLightGray = Color(0xFFE2E2E2)

// Extension to collectAsState cleanly on generic scopes and collect VM state
@Composable
private fun ArenaViewModel.collectAsState() = state.collectAsState()
