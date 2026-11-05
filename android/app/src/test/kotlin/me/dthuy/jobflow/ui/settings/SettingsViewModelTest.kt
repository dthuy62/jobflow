package me.dthuy.jobflow.ui.settings

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.domain.auth.Session
import me.dthuy.jobflow.domain.auth.Uid
import me.dthuy.jobflow.domain.model.Account
import me.dthuy.jobflow.testing.FakeAccountRepository
import me.dthuy.jobflow.testing.FakeAuthRepository
import me.dthuy.jobflow.testing.FakeHealthRepository
import me.dthuy.jobflow.testing.MEMBER_SESSION
import me.dthuy.jobflow.testing.unreachableSnapshot
import me.dthuy.jobflow.ui.health.HealthUiKind
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SettingsViewModelTest {
    private val dispatcher = UnconfinedTestDispatcher()
    private val accounts = FakeAccountRepository()

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `settings reflects the latest health`() = runTest {
        val health = FakeHealthRepository()
        val vm = SettingsViewModel(health, FakeAuthRepository(), FakeAccountRepository())
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        health.publish(unreachableSnapshot())

        assertEquals(HealthUiKind.UNREACHABLE, vm.uiState.value.health.kind)
    }

    @Test
    fun `check again forces a refresh`() = runTest {
        val health = FakeHealthRepository()
        val vm = SettingsViewModel(health, FakeAuthRepository(), FakeAccountRepository())
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        vm.onCheckAgain()

        assertEquals(listOf(true), health.refreshes)
        assertEquals(HealthUiKind.READY, vm.uiState.value.health.kind)
    }

    @Test
    fun `nobody signed in means the API is not called`() = runTest {
        val vm = settings(FakeAuthRepository(session = Session.SignedOut(canStartGuest = true)))
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        assertEquals(0, accounts.calls)
        assertEquals(AccountCheck.Idle, vm.uiState.value.accountCheck)
    }

    @Test
    fun `a signed-in user is checked with the API`() = runTest {
        settings(FakeAuthRepository())

        assertEquals(1, accounts.calls)
    }

    @Test
    fun `a session change checks again`() = runTest {
        val auth = FakeAuthRepository()
        settings(auth)

        auth.publish(MEMBER_SESSION)

        assertEquals(2, accounts.calls)
    }

    @Test
    fun `a check that fails can be retried`() = runTest {
        accounts.account = Either.Left(AppError.Unreachable)
        val vm = settings(FakeAuthRepository(session = MEMBER_SESSION))
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }
        assertTrue(vm.uiState.value.accountCheck is AccountCheck.Failed)

        accounts.account = Either.Right(Account("user_1", isAnonymous = false))
        vm.onRetryAccount()

        assertEquals(AccountCheck.Idle, vm.uiState.value.accountCheck)
    }

    @Test
    fun `a good check clears a failed one after a session change`() = runTest {
        accounts.account = Either.Left(AppError.Unreachable)
        val auth = FakeAuthRepository()
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        accounts.account = Either.Right(Account("user_1", isAnonymous = false))
        auth.publish(MEMBER_SESSION)

        assertEquals(AccountCheck.Idle, vm.uiState.value.accountCheck)
    }

    @Test
    fun `a cancelled retry keeps the failed check`() = runTest {
        accounts.account = Either.Left(AppError.Unreachable)
        val vm = settings(FakeAuthRepository(session = MEMBER_SESSION))
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }
        accounts.failure = CancellationException("Task was cancelled")

        vm.onRetryAccount()

        assertTrue(vm.uiState.value.accountCheck is AccountCheck.Failed)
    }

    @Test
    fun `a retry that fails leaves the failure for the card to judge`() = runTest {
        accounts.account = Either.Left(AppError.Unauthorized)
        val vm = settings(FakeAuthRepository(session = MEMBER_SESSION))
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }
        val checksBefore = accounts.calls

        vm.onRetryAccount()

        assertEquals(checksBefore + 1, accounts.calls)
        assertTrue(vm.uiState.value.accountCheck is AccountCheck.Failed)
    }

    @Test
    fun `a new session drops the old failed check before its own answers`() = runTest {
        accounts.account = Either.Left(AppError.Unreachable)
        val auth = FakeAuthRepository()
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }
        accounts.gate = CompletableDeferred()

        auth.publish(MEMBER_SESSION)

        assertEquals(AccountCheck.Idle, vm.uiState.value.accountCheck)
        accounts.gate?.complete(Unit)
    }

    @Test
    fun `a retry from the old session cannot override the new session's check`() = runTest {
        val auth = FakeAuthRepository(session = MEMBER_SESSION)
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }
        val oldRetry = CompletableDeferred<Unit>()
        accounts.gate = oldRetry
        accounts.account = Either.Left(AppError.Unauthorized)
        vm.onRetryAccount()

        accounts.gate = null
        accounts.account = Either.Right(Account("user_2", isAnonymous = false))
        auth.publish(Session.Guest(Uid("uid_new")))
        accounts.account = Either.Left(AppError.Unauthorized)
        oldRetry.complete(Unit)

        assertEquals(AccountCheck.Idle, vm.uiState.value.accountCheck)
    }

    private fun settings(auth: FakeAuthRepository) = SettingsViewModel(FakeHealthRepository(), auth, accounts)
}
