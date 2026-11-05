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
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Session
import me.dthuy.jobflow.domain.model.Account
import me.dthuy.jobflow.testing.FakeAccountRepository
import me.dthuy.jobflow.testing.FakeAuthRepository
import me.dthuy.jobflow.testing.FakeHealthRepository
import me.dthuy.jobflow.testing.MEMBER_SESSION
import me.dthuy.jobflow.testing.unreachableSnapshot
import me.dthuy.jobflow.ui.health.HealthUiKind
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SettingsViewModelTest {
    private val dispatcher = UnconfinedTestDispatcher()
    private val accounts = FakeAccountRepository()
    private val token = IdToken("token")

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
    fun `the session reaches the screen`() = runTest {
        val vm = settings(FakeAuthRepository())
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        assertEquals(AccountKind.GUEST, vm.uiState.value.account.kind)
    }

    @Test
    fun `nobody signed in means no guest is created and the API is not called`() = runTest {
        val auth = FakeAuthRepository(session = Session.SignedOut(canStartGuest = true))
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        assertEquals(AccountKind.SIGNED_OUT, vm.uiState.value.account.kind)
        assertEquals(0, accounts.calls)
    }

    @Test
    fun `continuing as a guest starts a guest and checks them with the API`() = runTest {
        val auth = FakeAuthRepository(session = Session.SignedOut(canStartGuest = true))
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        vm.onContinueAsGuest()

        assertEquals(AccountKind.GUEST, vm.uiState.value.account.kind)
        assertEquals(1, accounts.calls)
    }

    @Test
    fun `an account check that fails keeps the user and can be retried`() = runTest {
        accounts.account = Either.Left(AppError.Unreachable)
        val vm = settings(FakeAuthRepository(session = MEMBER_SESSION))
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }
        assertEquals(AccountKind.GOOGLE, vm.uiState.value.account.kind)
        assertTrue(vm.uiState.value.account.canRetry)

        accounts.account = Either.Right(Account("user_1", isAnonymous = false))
        vm.onRetryAccount()

        assertEquals(AccountKind.GOOGLE, vm.uiState.value.account.kind)
        assertNull(vm.uiState.value.account.error)
    }

    @Test
    fun `signing in with Google shows the new session`() = runTest {
        val auth = FakeAuthRepository()
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        vm.onSignIn { Either.Right(token) }

        assertEquals(listOf(token), auth.tokens)
        assertEquals(AccountKind.GOOGLE, vm.uiState.value.account.kind)
    }

    @Test
    fun `closing the Google sheet changes nothing`() = runTest {
        val auth = FakeAuthRepository()
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        vm.onSignIn { Either.Right(null) }

        assertTrue(auth.tokens.isEmpty())
        assertEquals(AccountKind.GUEST, vm.uiState.value.account.kind)
        assertNull(vm.uiState.value.account.error)
    }

    @Test
    fun `a Google sheet failure keeps the guest and shows the error`() = runTest {
        val vm = settings(FakeAuthRepository())
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        vm.onSignIn { Either.Left(AuthError.NoGoogleAccount) }

        assertEquals(AccountKind.GUEST, vm.uiState.value.account.kind)
        assertNotNull(vm.uiState.value.account.error)
    }

    @Test
    fun `a failed sign-in keeps the guest and shows the error`() = runTest {
        val auth = FakeAuthRepository(signIn = Either.Left(AuthError.Network))
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        vm.onSignIn { Either.Right(token) }

        assertEquals(AccountKind.GUEST, vm.uiState.value.account.kind)
        assertTrue(vm.uiState.value.account.canSignIn)
        assertNotNull(vm.uiState.value.account.error)
    }

    @Test
    fun `a second tap while Google's sheet is open does nothing`() = runTest {
        val vm = settings(FakeAuthRepository())
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }
        val sheet = CompletableDeferred<Unit>()
        var sheetsOpened = 0
        val request: suspend () -> Either<AuthError, IdToken?> = {
            sheetsOpened++
            sheet.await()
            Either.Right(null)
        }

        vm.onSignIn(request)
        vm.onSignIn(request)
        val running = vm.uiState.value.account
        sheet.complete(Unit)

        assertEquals(1, sheetsOpened)
        assertEquals(AccountKind.LOADING, running.kind)
        assertFalse(running.canSignIn || running.canSignOut || running.canRetry)
        assertEquals(AccountKind.GUEST, vm.uiState.value.account.kind)
    }

    @Test
    fun `the account check waits for a running sign-in, whose new token it needs`() = runTest {
        val auth = FakeAuthRepository()
        val gate = CompletableDeferred<Unit>()
        auth.gate = gate
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }
        val checksBefore = accounts.calls

        vm.onSignIn { Either.Right(token) }
        auth.publish(MEMBER_SESSION)
        val checksWhileRunning = accounts.calls
        gate.complete(Unit)

        assertEquals(checksBefore, checksWhileRunning)
        assertEquals(checksBefore + 1, accounts.calls)
    }

    @Test
    fun `signing out ends the session and starts no guest`() = runTest {
        val auth = FakeAuthRepository(session = MEMBER_SESSION)
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        vm.onSignOut()

        assertEquals(1, auth.signOuts)
        assertEquals(AccountKind.SIGNED_OUT, vm.uiState.value.account.kind)
        assertFalse(vm.uiState.value.account.canContinueAsGuest)
    }

    @Test
    fun `a session that ends elsewhere reaches the screen`() = runTest {
        val auth = FakeAuthRepository(session = MEMBER_SESSION)
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        auth.publish(Session.SignedOut(canStartGuest = false))

        assertEquals(AccountKind.SIGNED_OUT, vm.uiState.value.account.kind)
    }

    @Test
    fun `closing the sheet keeps the sign-in prompt of a member the API rejected`() = runTest {
        accounts.account = Either.Left(AppError.Unauthorized)
        val vm = settings(FakeAuthRepository(session = MEMBER_SESSION))
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        vm.onSignIn { Either.Right(null) }

        assertTrue(vm.uiState.value.account.canSignIn)
        assertNotNull(vm.uiState.value.account.error)
    }

    @Test
    fun `a member the API rejected can try signing in again after a failure`() = runTest {
        accounts.account = Either.Left(AppError.Unauthorized)
        val vm = settings(FakeAuthRepository(session = MEMBER_SESSION, signIn = Either.Left(AuthError.Network)))
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        vm.onSignIn { Either.Right(token) }

        assertTrue(vm.uiState.value.account.canSignIn)
    }

    @Test
    fun `a session that ends drops the failed account check`() = runTest {
        accounts.account = Either.Left(AppError.Unreachable)
        val auth = FakeAuthRepository(session = MEMBER_SESSION)
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        auth.publish(Session.SignedOut(canStartGuest = false))

        assertNull(vm.uiState.value.account.error)
        assertFalse(vm.uiState.value.account.canRetry)
    }

    @Test
    fun `an action cancelled from outside does not leave the card loading`() = runTest {
        val auth = FakeAuthRepository()
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        vm.onSignIn { throw CancellationException("Task was cancelled") }

        assertEquals(AccountKind.GUEST, vm.uiState.value.account.kind)
        vm.onSignOut()
        assertEquals(1, auth.signOuts)
    }

    @Test
    fun `a session that ends while the sheet is open does not bring the failed check back`() = runTest {
        accounts.account = Either.Left(AppError.Unreachable)
        val auth = FakeAuthRepository()
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }
        val sheet = CompletableDeferred<Unit>()

        vm.onSignIn {
            sheet.await()
            Either.Right(null)
        }
        auth.publish(Session.SignedOut(canStartGuest = false))
        sheet.complete(Unit)

        assertNull(vm.uiState.value.account.error)
        assertFalse(vm.uiState.value.account.canRetry)
    }

    @Test
    fun `a retry that fails after the session ended offers no retry`() = runTest {
        accounts.account = Either.Left(AppError.Unreachable)
        val auth = FakeAuthRepository(session = MEMBER_SESSION)
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        auth.publish(Session.SignedOut(canStartGuest = false))
        vm.onRetryAccount()

        assertNull(vm.uiState.value.account.error)
        assertFalse(vm.uiState.value.account.canRetry)
    }

    @Test
    fun `a cancelled sign-in keeps the prompt of a member the API rejected`() = runTest {
        accounts.account = Either.Left(AppError.Unauthorized)
        val vm = settings(FakeAuthRepository(session = MEMBER_SESSION))
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }

        vm.onSignIn { throw CancellationException("Task was cancelled") }

        assertTrue(vm.uiState.value.account.canSignIn)
    }

    @Test
    fun `a cancelled retry keeps the retry button`() = runTest {
        accounts.account = Either.Left(AppError.Unreachable)
        val vm = settings(FakeAuthRepository(session = MEMBER_SESSION))
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }
        accounts.failure = CancellationException("Task was cancelled")

        vm.onRetryAccount()

        assertTrue(vm.uiState.value.account.canRetry)
    }

    @Test
    fun `signing in again as the same member asks the API again`() = runTest {
        accounts.account = Either.Left(AppError.Unauthorized)
        val auth = FakeAuthRepository(session = MEMBER_SESSION)
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }
        val checksBefore = accounts.calls

        vm.onSignIn { Either.Right(token) }

        assertEquals(checksBefore + 1, accounts.calls)
        assertTrue(vm.uiState.value.account.canSignIn)
        assertNotNull(vm.uiState.value.account.error)
    }

    @Test
    fun `a good sign-in after a failed one still asks the API again`() = runTest {
        accounts.account = Either.Left(AppError.Unauthorized)
        val auth = FakeAuthRepository(session = MEMBER_SESSION, signIn = Either.Left(AuthError.Network))
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }
        vm.onSignIn { Either.Right(token) }
        val checksBefore = accounts.calls
        auth.signIn = Either.Right(Unit)

        vm.onSignIn { Either.Right(token) }

        assertEquals(checksBefore + 1, accounts.calls)
        assertTrue(vm.uiState.value.account.canSignIn)
        assertNotNull(vm.uiState.value.account.error)
    }

    @Test
    fun `a guest's sign-in asks the API once, through the session change`() = runTest {
        accounts.account = Either.Left(AppError.Unreachable)
        val auth = FakeAuthRepository()
        val vm = settings(auth)
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }
        val checksBefore = accounts.calls

        vm.onSignIn { Either.Right(token) }

        assertEquals(checksBefore + 1, accounts.calls)
    }

    private fun settings(auth: FakeAuthRepository) = SettingsViewModel(FakeHealthRepository(), auth, accounts)
}
