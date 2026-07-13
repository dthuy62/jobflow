package me.dthuy.jobflow.careerops

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import me.dthuy.jobflow.core.DataSourceError
import me.dthuy.jobflow.core.Either
import me.dthuy.jobflow.core.NetworkError
import me.dthuy.jobflow.core.left
import me.dthuy.jobflow.core.right
import me.dthuy.jobflow.domain.model.Health
import me.dthuy.jobflow.domain.repository.JobFlowRepository
import me.dthuy.jobflow.domain.usecase.CheckHealthUseCase
import me.dthuy.jobflow.presentation.screen.jobflow.HealthUiKind
import me.dthuy.jobflow.presentation.screen.jobflow.JobFlowDestination
import me.dthuy.jobflow.presentation.screen.jobflow.JobFlowShellIntent
import me.dthuy.jobflow.presentation.screen.jobflow.JobFlowShellViewModel
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class JobFlowShellViewModelTest {
    private val dispatcher: TestDispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun mapsReadyHealthToReadyUiState() =
        runTest(dispatcher) {
            val useCase = CheckHealthUseCase(FakeJobFlowRepository(readyHealth().right()))
            val viewModel = JobFlowShellViewModel(useCase)

            advanceUntilIdle()

            assertEquals(HealthUiKind.READY, viewModel.state.value.health.kind)
            assertFalse(viewModel.state.value.showHealthDialog)
        }

    @Test
    fun keepsUnhealthyDialogVisibleUntilUserDismissesIt() =
        runTest(dispatcher) {
            val useCase = CheckHealthUseCase(FakeJobFlowRepository(notReadyHealth().right()))
            val first = JobFlowShellViewModel(useCase)
            advanceUntilIdle()

            assertEquals(HealthUiKind.NOT_READY, first.state.value.health.kind)
            assertTrue(first.state.value.showHealthDialog)

            val recreatedBeforeDismiss = JobFlowShellViewModel(useCase)
            advanceUntilIdle()

            assertEquals(HealthUiKind.NOT_READY, recreatedBeforeDismiss.state.value.health.kind)
            assertTrue(recreatedBeforeDismiss.state.value.showHealthDialog)

            first.handleIntent(JobFlowShellIntent.DismissHealthDialog)
            assertFalse(first.state.value.showHealthDialog)

            val recreatedAfterDismiss = JobFlowShellViewModel(useCase)
            advanceUntilIdle()

            assertEquals(HealthUiKind.NOT_READY, recreatedAfterDismiss.state.value.health.kind)
            assertFalse(recreatedAfterDismiss.state.value.showHealthDialog)
        }

    @Test
    fun openingHealthDetailsDismissesDialogAndSelectsSettings() =
        runTest(dispatcher) {
            val useCase = CheckHealthUseCase(FakeJobFlowRepository(notReadyHealth().right()))
            val viewModel = JobFlowShellViewModel(useCase)
            advanceUntilIdle()

            viewModel.handleIntent(JobFlowShellIntent.OpenHealthDetails)

            assertEquals(JobFlowDestination.SETTINGS, viewModel.state.value.selectedDestination)
            assertFalse(viewModel.state.value.showHealthDialog)

            val recreated = JobFlowShellViewModel(useCase)
            advanceUntilIdle()

            assertFalse(recreated.state.value.showHealthDialog)
        }

    @Test
    fun mapsNetworkFailureToUnreachable() =
        runTest(dispatcher) {
            val useCase =
                CheckHealthUseCase(
                    FakeJobFlowRepository(NetworkError.IOExceptionError(IOException("offline")).left()),
                )
            val viewModel = JobFlowShellViewModel(useCase)

            advanceUntilIdle()

            assertEquals(HealthUiKind.UNREACHABLE, viewModel.state.value.health.kind)
            assertTrue(viewModel.state.value.showHealthDialog)
        }

    @Test
    fun forceRefreshRunsHealthCheckAgain() =
        runTest(dispatcher) {
            val repository = FakeJobFlowRepository(readyHealth().right(), notReadyHealth().right())
            val useCase = CheckHealthUseCase(repository)
            val viewModel = JobFlowShellViewModel(useCase)
            advanceUntilIdle()

            viewModel.handleIntent(JobFlowShellIntent.CheckAgain)
            advanceUntilIdle()

            assertEquals(2, repository.calls)
            assertEquals(HealthUiKind.NOT_READY, viewModel.state.value.health.kind)
        }

    @Test
    fun forceRefreshCancelsOlderInFlightRefresh() =
        runTest(dispatcher) {
            val firstResult = CompletableDeferred<Either<DataSourceError, Health>>()
            val secondResult = CompletableDeferred<Either<DataSourceError, Health>>()
            val repository = DeferredJobFlowRepository(firstResult, secondResult)
            val viewModel = JobFlowShellViewModel(CheckHealthUseCase(repository))
            advanceUntilIdle()

            viewModel.handleIntent(JobFlowShellIntent.CheckAgain)
            secondResult.complete(notReadyHealth().right())
            advanceUntilIdle()

            assertEquals(HealthUiKind.NOT_READY, viewModel.state.value.health.kind)

            firstResult.complete(readyHealth().right())
            advanceUntilIdle()

            assertEquals(HealthUiKind.NOT_READY, viewModel.state.value.health.kind)
        }

    @Test
    fun guidanceIncludesMissingRequirementsAndBackendMessages() =
        runTest(dispatcher) {
            val viewModel = JobFlowShellViewModel(CheckHealthUseCase(FakeJobFlowRepository(notReadyHealth().right())))
            advanceUntilIdle()

            assertEquals(
                listOf(
                    "workspace",
                    "scan-script",
                    "Career Ops workspace is missing.",
                    "Scan script is missing.",
                ),
                viewModel.state.value.health.guidanceItems,
            )
        }

    @Test
    fun selectsDestinationInUiState() =
        runTest(dispatcher) {
            val viewModel = JobFlowShellViewModel(CheckHealthUseCase(FakeJobFlowRepository(readyHealth().right())))
            advanceUntilIdle()

            viewModel.handleIntent(JobFlowShellIntent.SelectDestination(JobFlowDestination.SETTINGS))

            assertEquals(JobFlowDestination.SETTINGS, viewModel.state.value.selectedDestination)
        }
}

private class DeferredJobFlowRepository(
    private vararg val results: CompletableDeferred<Either<DataSourceError, Health>>,
) : JobFlowRepository {
    private var calls = 0

    override suspend fun getHealth(): Either<DataSourceError, Health> {
        val index = calls.coerceAtMost(results.lastIndex)
        calls += 1
        return results[index].await()
    }
}
