package me.dthuy.jobflow.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import me.dthuy.jobflow.ui.theme.JobFlowInk
import me.dthuy.jobflow.ui.theme.JobFlowMuted
import me.dthuy.jobflow.ui.theme.JobFlowSurface
import me.dthuy.jobflow.ui.theme.JobFlowYellow
import me.dthuy.jobflow.ui.theme.Spacing

private val CardShape = RoundedCornerShape(28.dp)
private val CardShadow = Color(0x18000000)

@Composable
fun SoftCard(
    modifier: Modifier = Modifier,
    backgroundColor: Color = JobFlowSurface,
    content: @Composable ColumnScope.() -> Unit,
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .shadow(elevation = 14.dp, shape = CardShape, spotColor = CardShadow),
        shape = CardShape,
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
fun SoftButton(
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
        colors = ButtonDefaults.buttonColors(
            containerColor = containerColor,
            contentColor = JobFlowInk,
            disabledContainerColor = JobFlowMuted.copy(alpha = 0.24f),
            disabledContentColor = JobFlowMuted,
        ),
        content = content,
    )
}

@Composable
fun SoftBadge(text: String, backgroundColor: Color, modifier: Modifier = Modifier, textColor: Color = JobFlowInk) {
    Surface(modifier = modifier, shape = CircleShape, color = backgroundColor) {
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

@Composable
fun SectionLabel(text: String) {
    Text(
        text = "[$text]",
        color = JobFlowInk,
        fontSize = 12.sp,
        fontFamily = FontFamily.Monospace,
        fontWeight = FontWeight.Black,
    )
}

@Composable
fun DetailRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.sm)) {
        Text(
            text = label.uppercase(),
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
