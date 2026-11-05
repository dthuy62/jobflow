package me.dthuy.jobflow.navigation

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.kyant.backdrop.Backdrop
import com.kyant.backdrop.drawBackdrop
import com.kyant.backdrop.effects.blur
import com.kyant.backdrop.effects.lens
import com.kyant.backdrop.effects.vibrancy
import kotlin.math.roundToInt
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch

private val SoftNavIndicator = Color(0xFFDFF5F2).copy(alpha = 0.85f) // Liquid mint indicator
private val SoftNavIconActive = Color(0xFF1E2025) // High contrast active charcoal
private val SoftNavIconInactive = Color(0xFF8F96A3) // Muted inactive gray

@Composable
fun JobFlowBottomNavigation(
    selectedTab: TopLevelTab,
    onSelectTab: (TopLevelTab) -> Unit,
    backdrop: Backdrop,
    modifier: Modifier = Modifier,
) {
    val destinations = remember { TopLevelTab.entries.toList() }
    val selectedIndex = destinations.indexOf(selectedTab).coerceAtLeast(0)

    // Compact elegant sizes
    val itemWidth = 56.dp
    val itemSpacing = 12.dp
    val barHeight = 48.dp
    val totalWidth = itemWidth * destinations.size + itemSpacing * (destinations.size - 1) + 12.dp

    Box(
        modifier =
        modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(start = 24.dp, end = 24.dp, bottom = 12.dp),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier =
            Modifier
                .glassBar(backdrop)
                .width(totalWidth)
                .height(barHeight),
        ) {
            ElasticNavIndicator(
                selectedIndex = selectedIndex,
                itemWidth = itemWidth,
                itemSpacing = itemSpacing,
                modifier =
                Modifier
                    .padding(vertical = 4.dp)
                    .width(itemWidth)
                    .fillMaxHeight(),
            )

            Row(
                modifier =
                Modifier
                    .padding(horizontal = 6.dp)
                    .fillMaxHeight(),
                horizontalArrangement = Arrangement.spacedBy(itemSpacing),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                destinations.forEach { tab ->
                    JobFlowBottomNavItem(
                        tab = tab,
                        selected = tab == selectedTab,
                        onClick = {
                            if (tab != selectedTab) {
                                onSelectTab(tab)
                            }
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun ElasticNavIndicator(
    selectedIndex: Int,
    itemWidth: androidx.compose.ui.unit.Dp,
    itemSpacing: androidx.compose.ui.unit.Dp,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current
    val itemWidthPx = with(density) { itemWidth.toPx() }
    val itemStepPx = with(density) { (itemWidth + itemSpacing).toPx() }

    val targetLeft = selectedIndex * itemStepPx + with(density) { 6.dp.toPx() }
    val targetRight = targetLeft + itemWidthPx

    val left = remember { Animatable(targetLeft) }
    val right = remember { Animatable(targetRight) }
    var previousIndex by remember { mutableStateOf(selectedIndex) }

    LaunchedEffect(selectedIndex, itemWidthPx, itemStepPx) {
        val movingRight = selectedIndex > previousIndex
        previousIndex = selectedIndex
        val leadEasing = CubicBezierEasing(0.22f, 1f, 0.36f, 1f)
        val followEasing = FastOutSlowInEasing

        coroutineScope {
            launch {
                left.animateTo(
                    targetValue = targetLeft,
                    animationSpec =
                    tween(
                        durationMillis = 350,
                        easing = if (movingRight) followEasing else leadEasing,
                    ),
                )
            }
            launch {
                right.animateTo(
                    targetValue = targetRight,
                    animationSpec =
                    tween(
                        durationMillis = 350,
                        easing = if (movingRight) leadEasing else followEasing,
                    ),
                )
            }
        }
    }

    Box(
        modifier =
        modifier
            .offset { IntOffset(left.value.roundToInt(), 0) }
            .width(with(density) { (right.value - left.value).toDp() })
            .background(SoftNavIndicator, CircleShape),
    )
}

@Composable
private fun JobFlowBottomNavItem(tab: TopLevelTab, selected: Boolean, onClick: () -> Unit) {
    val tint by animateColorAsState(
        targetValue = if (selected) SoftNavIconActive else SoftNavIconInactive,
        animationSpec = tween(durationMillis = 260),
        label = "bottomNavIconTint",
    )
    val scale = if (selected) 1.05f else 1f

    Box(
        modifier =
        Modifier
            .width(56.dp)
            .fillMaxHeight() // Touch target height constraint >= 48dp satisfied
            .clickable(
                role = Role.Tab,
                onClick = onClick,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = tab.icon,
            contentDescription = stringResource(tab.label),
            tint = tint,
            modifier = Modifier.size((22 * scale).dp),
        )
    }
}

/** Frosted, lens-distorted pill drawn from whatever the [backdrop] layer captured behind the bar. */
@Composable
private fun Modifier.glassBar(backdrop: Backdrop): Modifier {
    val density = LocalDensity.current
    val blurRadiusPx = with(density) { 16.dp.toPx() }
    val lensRadiusPx = with(density) { 16.dp.toPx() }
    val lensStrengthPx = with(density) { 32.dp.toPx() }
    return shadow(
        elevation = 20.dp,
        shape = CircleShape,
        ambientColor = Color(0x0D000000),
        spotColor = Color(0x1F000000),
    ).drawBackdrop(
        backdrop = backdrop,
        shape = { CircleShape },
        effects = {
            vibrancy()
            blur(blurRadiusPx)
            lens(lensRadiusPx, lensStrengthPx)
        },
        onDrawSurface = { drawRect(Color.White.copy(alpha = 0.5f)) },
    ).border(
        width = 1.dp,
        color = Color(0x2BFFFFFF), // Bezel gloss highlight
        shape = CircleShape,
    )
}
