package me.dthuy.jobflow.careerops

import kotlinx.coroutines.test.runTest
import me.dthuy.jobflow.core.DataSourceError
import me.dthuy.jobflow.core.Either
import me.dthuy.jobflow.core.NetworkError
import me.dthuy.jobflow.core.left
import me.dthuy.jobflow.core.right
import me.dthuy.jobflow.domain.model.ApiVersion
import me.dthuy.jobflow.domain.model.CareerOpsReadiness
import me.dthuy.jobflow.domain.model.ExecutionMode
import me.dthuy.jobflow.domain.model.Health
import me.dthuy.jobflow.domain.model.HealthCapabilities
import me.dthuy.jobflow.domain.model.HealthStatus
import me.dthuy.jobflow.domain.model.ReadinessStatus
import me.dthuy.jobflow.domain.model.ScannerCommandType
import me.dthuy.jobflow.domain.model.ScannerReadiness
import me.dthuy.jobflow.domain.model.WorkspaceHealth
import me.dthuy.jobflow.domain.model.WorkspaceStatus
import me.dthuy.jobflow.domain.repository.JobFlowRepository
import me.dthuy.jobflow.domain.usecase.CheckHealthUseCase
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class CheckHealthUseCaseTest {
    @Test
    fun reusesFreshHealthSnapshot() =
        runTest {
            var now = 1_000L
            val repository =
                FakeJobFlowRepository(
                    readyHealth().right(),
                    notReadyHealth().right(),
                )
            val useCase = CheckHealthUseCase(repository, clock = { now })

            val first = useCase()
            now += CheckHealthUseCase.FRESHNESS_WINDOW_MILLIS - 1
            val second = useCase()

            assertEquals(1, repository.calls)
            assertEquals(first, second)
        }

    @Test
    fun refreshesStaleHealthSnapshot() =
        runTest {
            var now = 1_000L
            val repository =
                FakeJobFlowRepository(
                    readyHealth().right(),
                    notReadyHealth().right(),
                )
            val useCase = CheckHealthUseCase(repository, clock = { now })

            useCase()
            now += CheckHealthUseCase.FRESHNESS_WINDOW_MILLIS + 1
            val refreshed = useCase()

            assertEquals(2, repository.calls)
            assertEquals(HealthStatus.NOT_READY, (refreshed.result as Either.Right<Health>).value.status)
            assertEquals(now, refreshed.checkedAtMillis)
        }

    @Test
    fun forceRefreshBypassesFreshCache() =
        runTest {
            val repository =
                FakeJobFlowRepository(
                    readyHealth().right(),
                    notReadyHealth().right(),
                )
            val useCase = CheckHealthUseCase(repository, clock = { 1_000L })

            useCase()
            val refreshed = useCase(forceRefresh = true)

            assertEquals(2, repository.calls)
            assertEquals(HealthStatus.NOT_READY, (refreshed.result as Either.Right<Health>).value.status)
        }

    @Test
    fun returnsUnreachableFailureSnapshot() =
        runTest {
            val failure = NetworkError.IOExceptionError(IOException("offline"))
            val repository = FakeJobFlowRepository(failure.left())
            val useCase = CheckHealthUseCase(repository, clock = { 1_000L })

            val snapshot = useCase()

            assertTrue(snapshot.result is Either.Left)
            assertEquals(failure, (snapshot.result as Either.Left<DataSourceError>).value)
        }

    @Test
    fun marksUnhealthyDialogDismissedOnlyWhenRequested() =
        runTest {
            val repository = FakeJobFlowRepository(notReadyHealth().right())
            val useCase = CheckHealthUseCase(repository, clock = { 1_000L })

            useCase()

            assertTrue(useCase.shouldShowUnhealthyDialog())

            useCase.dismissUnhealthyDialog()

            assertEquals(false, useCase.shouldShowUnhealthyDialog())
        }
}

class FakeJobFlowRepository(
    private vararg val results: Either<DataSourceError, Health>,
) : JobFlowRepository {
    var calls = 0

    override suspend fun getHealth(): Either<DataSourceError, Health> {
        val index = calls.coerceAtMost(results.lastIndex)
        calls += 1
        return results[index]
    }
}

fun readyHealth(): Health =
    Health(
        status = HealthStatus.READY,
        apiVersion = ApiVersion.V1,
        workspace =
            WorkspaceHealth(
                status = WorkspaceStatus.READY,
                detected = true,
                careerOpsVersion = null,
                missingRequirements = emptyList(),
                messages = listOf("Workspace ready."),
            ),
        careerOps =
            CareerOpsReadiness(
                status = ReadinessStatus.READY,
                executionMode = ExecutionMode.LOCAL_SCRIPT_RUNNER,
                providerApiKeyRequired = false,
                aiCliRequired = false,
                scanner =
                    ScannerReadiness(
                        status = ReadinessStatus.READY,
                        commandType = ScannerCommandType.LOCAL_SCRIPT,
                        missingRequirements = emptyList(),
                        checks = emptyList(),
                        messages = listOf("Scanner ready."),
                    ),
            ),
        capabilities =
            HealthCapabilities(
                cv = true,
                profile = true,
                portals = true,
                scan = false,
                reports = false,
                artifacts = false,
                cvConversion = false,
                geminiEvaluation = false,
            ),
        serverTime = "2026-06-28T16:00:00.000Z",
    )

fun notReadyHealth(): Health =
    readyHealth().copy(
        status = HealthStatus.NOT_READY,
        workspace =
            readyHealth().workspace.copy(
                status = WorkspaceStatus.MISSING,
                detected = false,
                missingRequirements = listOf("workspace"),
                messages = listOf("Career Ops workspace is missing."),
            ),
        careerOps =
            readyHealth().careerOps.copy(
                status = ReadinessStatus.NOT_READY,
                scanner =
                    readyHealth().careerOps.scanner.copy(
                        status = ReadinessStatus.NOT_READY,
                        missingRequirements = listOf("scan-script"),
                        messages = listOf("Scan script is missing."),
                    ),
            ),
    )
