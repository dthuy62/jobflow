package me.dthuy.jobflow.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.navigation3.rememberViewModelStoreNavEntryDecorator
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.runtime.rememberSaveableStateHolderNavEntryDecorator
import androidx.navigation3.ui.NavDisplay
import com.kyant.backdrop.backdrops.layerBackdrop
import com.kyant.backdrop.backdrops.rememberLayerBackdrop
import me.dthuy.jobflow.ui.home.HomeRoute
import me.dthuy.jobflow.ui.home.HomeScreen
import me.dthuy.jobflow.ui.inputs.InputsRoute
import me.dthuy.jobflow.ui.inputs.InputsScreen
import me.dthuy.jobflow.ui.settings.SettingsRoute
import me.dthuy.jobflow.ui.settings.SettingsScreen
import me.dthuy.jobflow.ui.theme.JobFlowBackground

/**
 * The only place that knows about every feature. Features expose a Route and a Screen;
 * they never reference each other, they only receive callbacks like `onOpenSettings`.
 */
@Composable
fun AppNavigation() {
    val backStack = rememberNavBackStack(HomeRoute)
    val selectTab: (TopLevelTab) -> Unit = { tab ->
        backStack.clear()
        backStack.addAll(topLevelStack(tab.route))
    }
    // The bottom bar blurs whatever is drawn into this layer, so the pages scroll under real frosted glass.
    val backdrop = rememberLayerBackdrop {
        drawRect(JobFlowBackground)
        drawContent()
    }

    Scaffold(
        containerColor = JobFlowBackground,
        bottomBar = {
            JobFlowBottomNavigation(
                selectedTab = TopLevelTab.of(backStack),
                onSelectTab = selectTab,
                backdrop = backdrop,
            )
        },
    ) { innerPadding ->
        NavDisplay(
            backStack = backStack,
            modifier = Modifier.fillMaxSize().layerBackdrop(backdrop),
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
                entry<HomeRoute> {
                    HomeScreen(
                        contentPadding = innerPadding,
                        onOpenSettings = { selectTab(TopLevelTab.SETTINGS) },
                        onOpenInputs = { selectTab(TopLevelTab.INPUTS) },
                    )
                }
                entry<InputsRoute> { InputsScreen(contentPadding = innerPadding) }
                entry<SettingsRoute> { SettingsScreen(contentPadding = innerPadding) }
            },
        )
    }
}
