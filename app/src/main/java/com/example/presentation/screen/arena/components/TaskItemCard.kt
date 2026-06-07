package com.example.presentation.screen.arena.components

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.domain.model.TaskDare
import com.example.presentation.component.NeoBadge
import com.example.presentation.component.NeoCard
import com.example.presentation.screen.arena.TaskRoast
import com.example.presentation.screen.arena.accentColor
import com.example.presentation.screen.arena.roastState
import com.example.ui.theme.NeoBlack
import com.example.ui.theme.NeoBlue
import com.example.ui.theme.NeoPink
import com.example.ui.theme.NeoRed
import com.example.ui.theme.NeoWhite
import com.example.ui.theme.NeoYellow

@Composable
fun TaskItemCard(
    task: TaskDare,
    onCheckedChange: () -> Unit,
    onDelete: () -> Unit,
    onRetryRoast: () -> Unit,
    modifier: Modifier = Modifier
) {
    NeoCard(
        backgroundColor = if (task.isCompleted) Color(0xFFE2E2E2) else NeoWhite,
        shadowOffset = 4.dp,
        shape = RoundedCornerShape(16.dp),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            TaskHeader(task = task, onCheckedChange = onCheckedChange, onDelete = onDelete)

            if (task.description.isNotBlank()) {
                Text(
                    task.description,
                    fontSize = 12.sp,
                    color = if (task.isCompleted) Color.Gray else Color.DarkGray,
                    fontWeight = FontWeight.Medium
                )
            }

            TaskBadges(task = task)
            HorizontalDivider(color = NeoBlack, thickness = 1.5.dp)
            RoastSection(roast = task.roastState(), onRetryRoast = onRetryRoast)
        }
    }
}

@Composable
private fun TaskHeader(task: TaskDare, onCheckedChange: () -> Unit, onDelete: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(modifier = Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .background(
                        if (task.isCompleted) com.example.ui.theme.NeoGreen else NeoWhite,
                        shape = RoundedCornerShape(6.dp)
                    )
                    .border(2.5.dp, NeoBlack, shape = RoundedCornerShape(6.dp))
                    .clickable { onCheckedChange() },
                contentAlignment = Alignment.Center
            ) {
                if (task.isCompleted) Text(
                    "✓",
                    color = NeoBlack,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.ExtraBold
                )
            }
            Spacer(Modifier.width(10.dp))
            Text(
                task.title, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold,
                color = if (task.isCompleted) Color.Gray else NeoBlack,
                textDecoration = if (task.isCompleted) TextDecoration.LineThrough else null,
                modifier = Modifier.padding(end = 8.dp)
            )
        }
        Box(
            modifier = Modifier
                .background(NeoRed, shape = RoundedCornerShape(8.dp))
                .border(1.5.dp, NeoBlack, shape = RoundedCornerShape(8.dp))
                .clickable { onDelete() }
                .padding(6.dp)
        ) {
            Icon(
                Icons.Default.Delete,
                contentDescription = "Delete",
                modifier = Modifier.size(14.dp),
                tint = NeoBlack
            )
        }
    }
}

@Composable
private fun TaskBadges(task: TaskDare) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        NeoBadge(text = task.difficulty.name, backgroundColor = task.difficulty.accentColor())
        NeoBadge(text = "⏱️ ${task.timeLimitMinutes}M", backgroundColor = NeoBlue)
        if (task.isCompleted) NeoBadge(text = "+${task.scoreEarned} XP", backgroundColor = NeoPink)
    }
}

/** Exhaustive rendering of AI roast state — no nested if/else. */
@Composable
private fun RoastSection(roast: TaskRoast, onRetryRoast: () -> Unit) {
    when (roast) {
        is TaskRoast.InProgress -> RoastLoading()
        is TaskRoast.Available -> RoastVerdict(verdict = roast.verdict, onRetry = onRetryRoast)
        is TaskRoast.NotRequested -> RoastPrompt(onClick = onRetryRoast)
    }
}

@Composable
private fun RoastLoading() {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFE2E2E2), shape = RoundedCornerShape(8.dp))
            .border(1.5.dp, NeoBlack, shape = RoundedCornerShape(8.dp))
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
}

@Composable
private fun RoastVerdict(verdict: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFFFF2D4), shape = RoundedCornerShape(12.dp))
            .border(2.dp, NeoBlack, shape = RoundedCornerShape(12.dp))
            .padding(10.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.Star,
                    contentDescription = "VC",
                    tint = NeoYellow,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    "AI VENTURE CAPITALIST BOARD:",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = NeoBlack
                )
            }
            Box(
                modifier = Modifier
                    .background(NeoWhite, shape = RoundedCornerShape(6.dp))
                    .border(1.5.dp, NeoBlack, shape = RoundedCornerShape(6.dp))
                    .clickable { onRetry() }
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Icon(
                    Icons.Default.Refresh,
                    contentDescription = "Retry",
                    modifier = Modifier.size(10.dp),
                    tint = NeoBlack
                )
            }
        }
        Spacer(Modifier.height(4.dp))
        Text(
            verdict,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = NeoBlack,
            lineHeight = 14.sp
        )
    }
}

@Composable
private fun RoastPrompt(onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(NeoWhite, shape = RoundedCornerShape(10.dp))
            .border(1.5.dp, NeoBlack, shape = RoundedCornerShape(10.dp))
            .clickable { onClick() }
            .padding(8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            "⚡ GET AI VC REALITY CHECK ROAST",
            fontSize = 9.sp,
            fontWeight = FontWeight.ExtraBold,
            fontFamily = FontFamily.Monospace,
            color = NeoBlack
        )
    }
}
