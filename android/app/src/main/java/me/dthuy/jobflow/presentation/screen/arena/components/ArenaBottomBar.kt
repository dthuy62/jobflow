package me.dthuy.jobflow.presentation.screen.arena.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.dthuy.jobflow.domain.model.Difficulty
import me.dthuy.jobflow.presentation.component.NeoButton
import me.dthuy.jobflow.presentation.component.NeoCard
import me.dthuy.jobflow.presentation.component.NeoTextField
import me.dthuy.jobflow.presentation.screen.arena.ArenaUiIntent
import me.dthuy.jobflow.presentation.screen.arena.ArenaUiState
import me.dthuy.jobflow.ui.theme.NeoBg
import me.dthuy.jobflow.ui.theme.NeoBlack
import me.dthuy.jobflow.ui.theme.NeoGreen
import me.dthuy.jobflow.ui.theme.NeoOrange
import me.dthuy.jobflow.ui.theme.NeoPurple
import me.dthuy.jobflow.ui.theme.NeoRed
import me.dthuy.jobflow.ui.theme.NeoWhite
import me.dthuy.jobflow.ui.theme.NeoYellow

@Composable
fun ArenaBottomBar(
    state: ArenaUiState,
    onIntent: (ArenaUiIntent) -> Unit,
    modifier: Modifier = Modifier
) {
    if (!state.isCreateSheetOpen) {
        PitchFab(onClick = { onIntent(ArenaUiIntent.ToggleCreateSheet(true)) }, modifier = modifier)
    } else {
        CreatePanel(state = state, onIntent = onIntent, modifier = modifier)
    }
}

@Composable
private fun PitchFab(onClick: () -> Unit, modifier: Modifier = Modifier) {
    NeoButton(onClick = onClick, backgroundColor = NeoOrange, modifier = modifier.fillMaxWidth()) {
        Icon(Icons.Default.Add, contentDescription = "New", tint = NeoBlack)
        Spacer(Modifier.width(8.dp))
        Text(
            "PITCH NEW CHALLENGE",
            fontSize = 14.sp,
            fontWeight = FontWeight.ExtraBold,
            fontFamily = FontFamily.Monospace,
            color = NeoBlack
        )
    }
}

@Composable
private fun CreatePanel(
    state: ArenaUiState,
    onIntent: (ArenaUiIntent) -> Unit,
    modifier: Modifier = Modifier
) {
    NeoCard(
        backgroundColor = NeoWhite,
        shadowOffset = 8.dp,
        shape = RoundedCornerShape(
            topStart = 24.dp,
            topEnd = 24.dp,
            bottomStart = 16.dp,
            bottomEnd = 16.dp
        ),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            // Title row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(12.dp)
                            .background(NeoRed, shape = RoundedCornerShape(3.dp))
                            .border(1.5.dp, NeoBlack, shape = RoundedCornerShape(3.dp))
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "CHALLENGE GENERATOR LAB",
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 14.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
                Box(
                    Modifier
                        .background(NeoWhite, shape = CircleShape)
                        .border(2.dp, NeoBlack, shape = CircleShape)
                        .clickable { onIntent(ArenaUiIntent.ToggleCreateSheet(false)) }
                        .padding(4.dp)
                ) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "Close",
                        modifier = Modifier.size(14.dp),
                        tint = NeoBlack
                    )
                }
            }

            HorizontalDivider(color = NeoBlack, thickness = 2.dp)

            NeoTextField(
                value = state.titleInput,
                onValueChange = { onIntent(ArenaUiIntent.UpdateTitleInput(it)) },
                placeholder = "E.g., Write Auth Integration Tests",
                label = "Task Title"
            )
            NeoTextField(
                value = state.descriptionInput,
                onValueChange = { onIntent(ArenaUiIntent.UpdateDescInput(it)) },
                placeholder = "Details of what is being built...",
                label = "Specification specifics",
                singleLine = false
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                DifficultySelector(
                    selected = state.difficultyInput,
                    onSelected = { onIntent(ArenaUiIntent.UpdateDifficultyInput(it)) },
                    modifier = Modifier.weight(1f)
                )
                TimeLimitSelector(
                    value = state.timeLimitInput,
                    onChange = { onIntent(ArenaUiIntent.UpdateTimeInput(it)) },
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(Modifier.height(6.dp))

            NeoButton(
                onClick = {
                    onIntent(
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

@Composable
private fun DifficultySelector(
    selected: Difficulty,
    onSelected: (Difficulty) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        Box(
            Modifier
                .background(NeoPurple, shape = RoundedCornerShape(6.dp))
                .border(1.5.dp, NeoBlack, shape = RoundedCornerShape(6.dp))
                .padding(horizontal = 8.dp, vertical = 2.dp)
        ) {
            Text(
                "DIFFICULTY LEVEL",
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace
            )
        }
        Spacer(Modifier.height(4.dp))
        var expanded by remember { mutableStateOf(false) }
        Box(
            Modifier
                .fillMaxWidth()
                .background(NeoWhite, shape = RoundedCornerShape(10.dp))
                .border(2.5.dp, NeoBlack, shape = RoundedCornerShape(10.dp))
                .clickable { expanded = true }
                .padding(10.dp)
        ) {
            Text(
                selected.name,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace
            )
            DropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
                modifier = Modifier
                    .background(NeoWhite)
                    .border(2.dp, NeoBlack, shape = RoundedCornerShape(8.dp))
            ) {
                Difficulty.entries.forEach { d ->
                    DropdownMenuItem(text = {
                        Text(
                            d.name,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }, onClick = { onSelected(d); expanded = false })
                }
            }
        }
    }
}

@Composable
private fun TimeLimitSelector(value: Int, onChange: (Int) -> Unit, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        Box(
            Modifier
                .background(NeoGreen, shape = RoundedCornerShape(6.dp))
                .border(1.5.dp, NeoBlack, shape = RoundedCornerShape(6.dp))
                .padding(horizontal = 8.dp, vertical = 2.dp)
        ) {
            Text(
                "LIMIT MINUTES",
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace
            )
        }
        Spacer(Modifier.height(4.dp))
        Row(
            Modifier
                .fillMaxWidth()
                .background(NeoWhite, shape = RoundedCornerShape(10.dp))
                .border(2.5.dp, NeoBlack, shape = RoundedCornerShape(10.dp))
                .padding(2.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Box(
                Modifier
                    .background(NeoBg, shape = RoundedCornerShape(6.dp))
                    .border(1.5.dp, NeoBlack, shape = RoundedCornerShape(6.dp))
                    .clickable { onChange(value - 5) }
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text("-", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
            Text(
                "${value}m",
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace
            )
            Box(
                Modifier
                    .background(NeoBg, shape = RoundedCornerShape(6.dp))
                    .border(1.5.dp, NeoBlack, shape = RoundedCornerShape(6.dp))
                    .clickable { onChange(value + 5) }
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text("+", fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
        }
    }
}
