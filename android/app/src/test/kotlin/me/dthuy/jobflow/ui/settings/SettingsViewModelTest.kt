package me.dthuy.jobflow.ui.settings

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import me.dthuy.jobflow.domain.model.ThemeMode
import me.dthuy.jobflow.domain.repository.SettingsRepository
import me.dthuy.jobflow.testing.FakeHealthRepository
import me.dthuy.jobflow.testing.unreachableSnapshot
import me.dthuy.jobflow.ui.health.HealthUiKind
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SettingsViewModelTest {
    private val dispatcher = UnconfinedTestDispatcher()

    private class FakeSettingsRepository : SettingsRepository {
        private val mode = MutableStateFlow(ThemeMode.System)
        override val themeMode: Flow<ThemeMode> = mode

        override suspend fun setThemeMode(mode: ThemeMode) {
            this.mode.value = mode
        }
    }

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `selecting a theme updates ui state`() = runTest {
        val vm = SettingsViewModel(FakeSettingsRepository(), FakeHealthRepository())
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        vm.onThemeModeSelected(ThemeMode.Dark)

        assertEquals(ThemeMode.Dark, vm.uiState.value.themeMode)
    }

    @Test
    fun `settings reflects the latest health`() = runTest {
        val health = FakeHealthRepository()
        val vm = SettingsViewModel(FakeSettingsRepository(), health)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        health.publish(unreachableSnapshot())

        assertEquals(HealthUiKind.UNREACHABLE, vm.uiState.value.health.kind)
    }

    @Test
    fun `check again forces a refresh`() = runTest {
        val health = FakeHealthRepository()
        val vm = SettingsViewModel(FakeSettingsRepository(), health)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        vm.onCheckAgain()

        assertEquals(listOf(true), health.refreshes)
        assertEquals(HealthUiKind.READY, vm.uiState.value.health.kind)
    }
}
