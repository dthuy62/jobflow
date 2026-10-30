package me.dthuy.jobflow.navigation

import me.dthuy.jobflow.ui.home.HomeRoute
import me.dthuy.jobflow.ui.inputs.InputsRoute
import me.dthuy.jobflow.ui.settings.SettingsRoute
import org.junit.Assert.assertEquals
import org.junit.Test

class TopLevelTabsTest {
    @Test
    fun `home tab is the whole stack`() {
        assertEquals(listOf(HomeRoute), topLevelStack(HomeRoute))
    }

    @Test
    fun `other tabs sit on top of home`() {
        assertEquals(listOf(HomeRoute, InputsRoute), topLevelStack(InputsRoute))
        assertEquals(listOf(HomeRoute, SettingsRoute), topLevelStack(SettingsRoute))
    }

    @Test
    fun `selected tab follows the top of the stack`() {
        assertEquals(TopLevelTab.SETTINGS, TopLevelTab.of(topLevelStack(SettingsRoute)))
        assertEquals(TopLevelTab.HOME, TopLevelTab.of(topLevelStack(HomeRoute)))
    }
}
