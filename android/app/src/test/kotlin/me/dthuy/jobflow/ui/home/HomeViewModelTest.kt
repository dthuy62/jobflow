package me.dthuy.jobflow.ui.home

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import me.dthuy.jobflow.testing.FakeHealthRepository
import me.dthuy.jobflow.testing.notReadySnapshot
import me.dthuy.jobflow.testing.readySnapshot
import me.dthuy.jobflow.testing.unreachableSnapshot
import me.dthuy.jobflow.ui.health.HealthUiKind
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {
    private val dispatcher = UnconfinedTestDispatcher()

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `init refreshes without force`() {
        val repository = FakeHealthRepository()

        HomeViewModel(repository)

        assertEquals(listOf(false), repository.refreshes)
    }

    @Test
    fun `ready result never shows the dialog`() {
        val vm = HomeViewModel(FakeHealthRepository(readySnapshot()))

        assertEquals(HealthUiKind.READY, vm.state.value.health.kind)
        assertFalse(vm.state.value.showUnhealthyDialog)
    }

    @Test
    fun `unhealthy result shows the dialog once`() {
        val vm = HomeViewModel(FakeHealthRepository(unreachableSnapshot()))
        assertTrue(vm.state.value.showUnhealthyDialog)

        vm.onIntent(HomeIntent.DismissDialog)
        vm.onIntent(HomeIntent.CheckAgain)

        assertEquals(HealthUiKind.UNREACHABLE, vm.state.value.health.kind)
        assertFalse(vm.state.value.showUnhealthyDialog)
    }

    @Test
    fun `open health details consumes the dialog and navigates to settings`() = runTest {
        val vm = HomeViewModel(FakeHealthRepository(notReadySnapshot()))
        val effects = mutableListOf<HomeEffect>()
        backgroundScope.launch(dispatcher) { vm.effects.toList(effects) }

        vm.onIntent(HomeIntent.OpenHealthDetails)

        assertFalse(vm.state.value.showUnhealthyDialog)
        assertTrue(vm.state.value.unhealthyDialogConsumed)
        assertEquals(listOf(HomeEffect.NavigateToSettings), effects)
    }

    @Test
    fun `open inputs navigates to inputs`() = runTest {
        val vm = HomeViewModel(FakeHealthRepository())
        val effects = mutableListOf<HomeEffect>()
        backgroundScope.launch(dispatcher) { vm.effects.toList(effects) }

        vm.onIntent(HomeIntent.OpenInputs)

        assertEquals(listOf(HomeEffect.NavigateToInputs), effects)
    }

    @Test
    fun `check again forces a refresh and shows loading until it answers`() {
        val repository = FakeHealthRepository(readySnapshot())
        val vm = HomeViewModel(repository)
        val gate = CompletableDeferred<Unit>().also { repository.gate = it }

        vm.onIntent(HomeIntent.CheckAgain)
        assertEquals(HealthUiKind.LOADING, vm.state.value.health.kind)

        gate.complete(Unit)
        assertEquals(listOf(false, true), repository.refreshes)
        assertEquals(HealthUiKind.READY, vm.state.value.health.kind)
    }

    @Test
    fun `a cached answer clears loading even when latest does not change`() {
        val repository = FakeHealthRepository(readySnapshot())
        val vm = HomeViewModel(repository)

        vm.onIntent(HomeIntent.CheckAgain)

        assertEquals(HealthUiKind.READY, vm.state.value.health.kind)
    }

    @Test
    fun `health refreshed elsewhere updates home`() {
        val repository = FakeHealthRepository(readySnapshot())
        val vm = HomeViewModel(repository)

        repository.publish(unreachableSnapshot())

        assertEquals(HealthUiKind.UNREACHABLE, vm.state.value.health.kind)
    }
}
