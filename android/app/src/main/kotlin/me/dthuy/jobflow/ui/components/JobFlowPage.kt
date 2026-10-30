package me.dthuy.jobflow.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import me.dthuy.jobflow.R
import me.dthuy.jobflow.ui.theme.JobFlowInk
import me.dthuy.jobflow.ui.theme.Spacing

/**
 * A top-level tab page: big title, scrolling content, and room at the bottom so the last card can scroll out from
 * under the floating navigation bar. [contentPadding] comes from the app scaffold.
 */
@Composable
fun JobFlowPage(
    title: String,
    contentPadding: PaddingValues,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    val layoutDirection = LocalLayoutDirection.current
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(
                start = contentPadding.calculateStartPadding(layoutDirection) + Spacing.md,
                top = contentPadding.calculateTopPadding() + Spacing.md,
                end = contentPadding.calculateEndPadding(layoutDirection) + Spacing.md,
            ),
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        Column {
            Text(text = title.uppercase(), color = JobFlowInk, fontSize = 34.sp, fontWeight = FontWeight.Black)
            Text(
                text = stringResource(R.string.page_subtitle),
                color = JobFlowInk,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold,
            )
        }
        content()
        Spacer(Modifier.height(contentPadding.calculateBottomPadding() + Spacing.md))
    }
}
