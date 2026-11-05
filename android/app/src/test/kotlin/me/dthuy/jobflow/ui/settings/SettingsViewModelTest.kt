package me.dthuy.jobflow.ui.settings

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
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

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `settings reflects the latest health`() = runTest {
        val health = FakeHealthRepository()
        val vm = SettingsViewModel(health)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        health.publish(unreachableSnapshot())

        assertEquals(HealthUiKind.UNREACHABLE, vm.uiState.value.health.kind)
    }

    @Test
    fun `check again forces a refresh`() = runTest {
        val health = FakeHealthRepository()
        val vm = SettingsViewModel(health)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        vm.onCheckAgain()

        assertEquals(listOf(true), health.refreshes)
        assertEquals(HealthUiKind.READY, vm.uiState.value.health.kind)
    }
}
