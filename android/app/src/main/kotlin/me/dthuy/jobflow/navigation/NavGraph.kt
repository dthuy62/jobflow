package me.dthuy.jobflow.navigation

import androidx.compose.runtime.Composable
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import java.util.Map.entry
import me.dthuy.jobflow.ui.settings.SettingsRoute
import me.dthuy.jobflow.ui.settings.SettingsScreen

/**
 * The only place that knows about every feature. Features expose a Route and a Screen;
 * they never reference each other, they only receive callbacks like `onOpenSettings`.
 */
@Composable
fun AppNavigation() {
    val backStack = rememberNavBackStack(SettingsRoute)
    NavDisplay(
        backStack = backStack,
        onBack = { backStack.removeLastOrNull() },
        // Order matters: saved-state holder first, then the ViewModel store. Without the second one,
        // hiltViewModel() inside an entry would be scoped to the Activity and never cleared on pop.
        entryDecorators =
        listOf(
            rememberSaveableStateHolderNavEntryDecorator(),
            rememberViewModelStoreNavEntryDecorator(),
        ),
        entryProvider =
        entryProvider {
            entry<SettingsRoute> { SettingsScreen(onBack = { backStack.removeLastOrNull() }) }
        },
    )
}
