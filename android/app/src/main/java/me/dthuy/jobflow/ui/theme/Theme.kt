package me.dthuy.jobflow.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

private val LightColorScheme = lightColorScheme(
    primary = NeoYellow,
    secondary = NeoGreen,
    tertiary = NeoPurple,
    background = NeoBg,
    surface = NeoWhite,
    onPrimary = NeoBlack,
    onSecondary = NeoBlack,
    onTertiary = NeoBlack,
    onBackground = NeoBlack,
    onSurface = NeoBlack
)

// Helper dark background colors if needed
private val ColorSchemeDarkSurface = androidx.compose.ui.graphics.Color(0xFF2E2E2E)

private val DarkColorScheme = darkColorScheme(
    primary = NeoYellow,
    secondary = NeoGreen,
    tertiary = NeoPurple,
    background = NeoBlack,
    surface = ColorSchemeDarkSurface,
    onPrimary = NeoBlack,
    onSecondary = NeoWhite,
    onTertiary = NeoBlack,
    onBackground = NeoWhite,
    onSurface = NeoWhite
)

@Composable
fun MyApplicationTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false, // Disable dynamic colors to enforce the strict Neo-Brutalist design language
    content: @Composable () -> Unit,
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
