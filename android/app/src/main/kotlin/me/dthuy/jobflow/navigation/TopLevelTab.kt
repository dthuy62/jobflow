package me.dthuy.jobflow.navigation

import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation3.runtime.NavKey
import me.dthuy.jobflow.R
import me.dthuy.jobflow.ui.home.HomeRoute
import me.dthuy.jobflow.ui.inputs.InputsRoute
import me.dthuy.jobflow.ui.settings.SettingsRoute

enum class TopLevelTab(val route: NavKey, val icon: ImageVector, @param:StringRes val label: Int) {
    HOME(HomeRoute, Icons.Default.Home, R.string.nav_home),
    INPUTS(InputsRoute, Icons.Default.Add, R.string.nav_inputs),
    SETTINGS(SettingsRoute, Icons.Default.Settings, R.string.nav_settings),
    ;

    companion object {
        /** The tab whose route is on top of [stack]; Home when the top is not a tab. */
        fun of(stack: List<NavKey>): TopLevelTab = entries.firstOrNull { it.route == stack.lastOrNull() } ?: HOME
    }
}

/**
 * The back stack for a selected tab. Home always stays at the bottom, so back from any tab returns Home and the
 * Home ViewModel (with its show-once dialog state) is never cleared while the app runs.
 */
fun topLevelStack(tab: NavKey): List<NavKey> = if (tab == HomeRoute) listOf(HomeRoute) else listOf(HomeRoute, tab)
