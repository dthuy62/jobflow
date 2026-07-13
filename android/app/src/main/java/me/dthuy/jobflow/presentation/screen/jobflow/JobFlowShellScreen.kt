package me.dthuy.jobflow.presentation.screen.jobflow

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.kyant.backdrop.Backdrop
import com.kyant.backdrop.backdrops.layerBackdrop
import com.kyant.backdrop.backdrops.rememberLayerBackdrop
import me.dthuy.jobflow.presentation.component.JobFlowBottomNavigation

@Composable
fun CareerOpsShellScreen(
    viewModel: JobFlowShellViewModel,
    modifier: Modifier = Modifier,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    CareerOpsShellContent(
        state = state,
        onIntent = viewModel::handleIntent,
        modifier = modifier,
    )
}

@Composable
fun CareerOpsShellContent(
    state: JobFlowShellUiState,
    onIntent: (JobFlowShellIntent) -> Unit,
    modifier: Modifier = Modifier,
) {
    val backdrop =
        rememberLayerBackdrop {
            drawRect(JobFlowBackground)
            drawContent()
        }

    val layoutDirection = LocalLayoutDirection.current
    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = JobFlowBackground,
        bottomBar = {
            JobFlowBottomNavigation(
                selectedDestination = state.selectedDestination,
                onSelectDestination = { onIntent(JobFlowShellIntent.SelectDestination(it)) },
                backdrop = backdrop,
            )
        },
    ) { innerPadding ->
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .layerBackdrop(backdrop)
                    .verticalScroll(rememberScrollState())
                    .padding(
                        start = innerPadding.calculateStartPadding(layoutDirection) + 16.dp,
                        top = innerPadding.calculateTopPadding() + 12.dp,
                        end = innerPadding.calculateEndPadding(layoutDirection) + 16.dp,
                        bottom = 16.dp,
                    ),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Header(state.selectedDestination)
            when (state.selectedDestination) {
                JobFlowDestination.HOME -> {
                    HomePage(state.health) {
                        onIntent(JobFlowShellIntent.SelectDestination(JobFlowDestination.ADD))
                    }
                }

                JobFlowDestination.ADD -> {
                    AddPage()
                }

                JobFlowDestination.SETTINGS -> {
                    SettingsPage(state.health) {
                        onIntent(JobFlowShellIntent.CheckAgain)
                    }
                }
            }
            Spacer(modifier = Modifier.height(innerPadding.calculateBottomPadding() + 16.dp))
        }
    }

    if (state.showHealthDialog) {
        HealthDialog(
            health = state.health,
            onDismiss = { onIntent(JobFlowShellIntent.DismissHealthDialog) },
            onSettings = { onIntent(JobFlowShellIntent.OpenHealthDetails) },
        )
    }
}

@Composable
private fun Header(destination: JobFlowDestination) {
    Column {
        Text(
            text =
                when (destination) {
                    JobFlowDestination.HOME -> "JOBFLOW"
                    JobFlowDestination.ADD -> "ADD"
                    JobFlowDestination.SETTINGS -> "SETTINGS"
                },
            color = JobFlowInk,
            fontSize = 34.sp,
            fontWeight = FontWeight.Black,
        )
        Text(
            text = "CAREER OPS LOCAL WORKFLOW",
            color = JobFlowInk,
            fontSize = 12.sp,
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun HomePage(
    health: HealthUiState,
    onOpenAdd: () -> Unit,
) {
    HealthSummaryCard(health)
    SoftCard(backgroundColor = JobFlowYellow) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SectionLabel("NEXT ACTION")
            Text(
                text = "Add personal scan inputs",
                color = JobFlowInk,
                fontSize = 22.sp,
                fontWeight = FontWeight.Black,
            )
            Text(
                text = "CV, profile, and portal setup will live here next.",
                color = JobFlowInk,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
            )
            SoftButton(onClick = onOpenAdd, containerColor = JobFlowMint) {
                Text("OPEN ADD", color = JobFlowInk, fontWeight = FontWeight.Black)
            }
        }
    }
    ReadinessCard(health)
}

@Composable
private fun AddPage() {
    PlaceholderCard("CV", "Future CV input and review area.")
    PlaceholderCard("PROFILE", "Future profile and preference input area.")
    PlaceholderCard("PORTALS", "Future job portal/search configuration area.")
}

@Composable
private fun SettingsPage(
    health: HealthUiState,
    onCheckAgain: () -> Unit,
) {
    HealthSummaryCard(health)
    SoftCard {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SectionLabel("DETAILS")
            DetailRow("Wrapper", health.kind.wrapperLabel())
            DetailRow("Workspace", health.workspaceStatus)
            DetailRow("Scanner", health.scannerStatus)
            Text(
                text = "Last checked: ${health.checkedAtMillis?.toString() ?: "not yet"}",
                color = JobFlowInk,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
            )
            health.serverTime?.let {
                Text(
                    text = "Server time: $it",
                    color = JobFlowInk,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                )
            }
            SoftButton(
                onClick = onCheckAgain,
                enabled = health.kind != HealthUiKind.LOADING,
                containerColor = JobFlowBlue,
            ) {
                Text("CHECK AGAIN", color = JobFlowInk, fontWeight = FontWeight.Black)
            }
        }
    }
    SoftCard(backgroundColor = JobFlowSurface) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SectionLabel("GUIDANCE")
            val items = health.guidanceItems.ifEmpty { listOf(health.message) }
            items.forEach { item ->
                Text("[$item]", color = JobFlowInk, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun HealthSummaryCard(health: HealthUiState) {
    SoftCard(backgroundColor = health.kind.surfaceColor()) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SectionLabel("SYSTEM HEALTH")
                SoftBadge(text = health.title, backgroundColor = JobFlowSurface)
            }
            Text(
                text = health.message,
                color = JobFlowInk,
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
            )
        }
    }
}

@Composable
private fun ReadinessCard(health: HealthUiState) {
    SoftCard {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SectionLabel("READINESS SNAPSHOT")
            DetailRow("Workspace", health.workspaceStatus)
            DetailRow("Scanner", health.scannerStatus)
        }
    }
}

@Composable
private fun PlaceholderCard(
    title: String,
    message: String,
) {
    SoftCard {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            SectionLabel(title)
            Text(message, color = JobFlowInk, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "COMING SOON",
                color = JobFlowInk,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
            )
        }
    }
}

@Composable
private fun DetailRow(
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            label.uppercase(),
            modifier = Modifier.weight(1f),
            color = JobFlowInk,
            fontSize = 12.sp,
            fontFamily = FontFamily.Monospace,
        )
        Text(
            text = value.uppercase(),
            modifier = Modifier.weight(1f),
            color = JobFlowInk,
            fontSize = 12.sp,
            fontWeight = FontWeight.Black,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.End,
        )
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = "[$text]",
        color = JobFlowInk,
        fontSize = 12.sp,
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Black,
    )
}

@Composable
private fun HealthDialog(
    health: HealthUiState,
    onDismiss: () -> Unit,
    onSettings: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("LOCAL SETUP NEEDS ATTENTION", fontWeight = FontWeight.Black) },
        text = { Text(health.message, fontWeight = FontWeight.SemiBold) },
        confirmButton = {
            SoftButton(onClick = onSettings, containerColor = JobFlowYellow) {
                Text("SETTINGS", color = JobFlowInk, fontWeight = FontWeight.Black)
            }
        },
        dismissButton = {
            SoftButton(onClick = onDismiss, containerColor = JobFlowSurface) {
                Text("DISMISS", color = JobFlowInk, fontWeight = FontWeight.Black)
            }
        },
    )
}

@Composable
private fun SoftCard(
    modifier: Modifier = Modifier,
    backgroundColor: Color = JobFlowSurface,
    content: @Composable ColumnScope.() -> Unit,
) {
    Card(
        modifier =
            modifier
                .fillMaxWidth()
                .shadow(elevation = 14.dp, shape = RoundedCornerShape(28.dp), spotColor = Color(0x18000000)),
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            content = content,
        )
    }
}

@Composable
private fun SoftButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    containerColor: Color = JobFlowYellow,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit,
) {
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        shape = CircleShape,
        colors =
            ButtonDefaults.buttonColors(
                containerColor = containerColor,
                contentColor = JobFlowInk,
                disabledContainerColor = JobFlowMuted.copy(alpha = 0.24f),
                disabledContentColor = JobFlowMuted,
            ),
        content = content,
    )
}

@Composable
private fun SoftBadge(
    text: String,
    backgroundColor: Color,
    modifier: Modifier = Modifier,
    textColor: Color = JobFlowInk,
) {
    Surface(
        modifier = modifier,
        shape = CircleShape,
        color = backgroundColor,
    ) {
        Text(
            text = text.uppercase(),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
        )
    }
}

private val JobFlowBackground = Color(0xFFF4F5F9)
private val JobFlowSurface = Color(0xFFFEFEFF)
private val JobFlowInk = Color(0xFF24262D)
private val JobFlowMuted = Color(0xFF8F96A3)
private val JobFlowYellow = Color(0xFFFFD84D)
private val JobFlowMint = Color(0xFFDFF5F2)
private val JobFlowBlue = Color(0xFFDCEBFF)
private val JobFlowCoral = Color(0xFFFFC1A6)
private val JobFlowRed = Color(0xFFFF8B8B)

private fun HealthUiKind.surfaceColor(): Color =
    when (this) {
        HealthUiKind.LOADING -> JobFlowBlue

        HealthUiKind.READY -> JobFlowMint

        HealthUiKind.NOT_READY -> JobFlowCoral

        HealthUiKind.UNREACHABLE,
        HealthUiKind.INVALID_RESPONSE,
        -> JobFlowRed
    }

private fun HealthUiKind.wrapperLabel(): String =
    when (this) {
        HealthUiKind.UNREACHABLE -> "unreachable"
        HealthUiKind.INVALID_RESPONSE -> "invalid response"
        else -> "reachable"
    }
