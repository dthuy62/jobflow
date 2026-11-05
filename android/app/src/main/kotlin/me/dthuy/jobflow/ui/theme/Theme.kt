package me.dthuy.jobflow.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme =
    lightColorScheme(
        primary = NeoYellow,
        secondary = NeoGreen,
        tertiary = NeoPurple,
        background = NeoBg,
        surface = NeoWhite,
        onPrimary = NeoBlack,
        onSecondary = NeoBlack,
        onTertiary = NeoBlack,
        onBackground = NeoBlack,
        onSurface = NeoBlack,
    )

// Helper dark background colors if needed
private val ColorSchemeDarkSurface =
    androidx.compose.ui.graphics
        .Color(0xFF2E2E2E)

private val DarkColorScheme =
    darkColorScheme(
        primary = NeoYellow,
        secondary = NeoGreen,
        tertiary = NeoPurple,
        background = NeoBlack,
        surface = ColorSchemeDarkSurface,
        onPrimary = NeoBlack,
        onSecondary = NeoWhite,
        onTertiary = NeoBlack,
        onBackground = NeoWhite,
        onSurface = NeoWhite,
    )

@Composable
fun AppTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content,
    )
}
