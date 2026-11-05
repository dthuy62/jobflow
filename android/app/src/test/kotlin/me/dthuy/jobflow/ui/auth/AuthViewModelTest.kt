package me.dthuy.jobflow.ui.auth

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Session
import me.dthuy.jobflow.testing.FakeAuthRepository
import me.dthuy.jobflow.testing.MEMBER_SESSION
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AuthViewModelTest {
    private val dispatcher = UnconfinedTestDispatcher()
    private val token = IdToken("token")

    @Before
    fun setUp() = Dispatchers.setMain(dispatcher)

    @After
    fun tearDown() = Dispatchers.resetMain()

    @Test
    fun `the session reaches the screen`() = runTest {
        assertEquals(AuthKind.GUEST, viewModel(FakeAuthRepository()).uiState.value.kind)
    }

    @Test
    fun `a session that changes elsewhere reaches the screen`() = runTest {
        val auth = FakeAuthRepository(session = MEMBER_SESSION)
        val vm = viewModel(auth)

        auth.publish(Session.SignedOut(canStartGuest = false))

        assertEquals(AuthKind.SIGNED_OUT, vm.uiState.value.kind)
    }

    @Test
    fun `continuing as a guest starts a guest`() = runTest {
        val vm = viewModel(FakeAuthRepository(session = Session.SignedOut(canStartGuest = true)))

        vm.onContinueAsGuest()

        assertEquals(AuthKind.GUEST, vm.uiState.value.kind)
    }

    @Test
    fun `signing in with Google shows the new session`() = runTest {
        val auth = FakeAuthRepository()
        val vm = viewModel(auth)

        vm.onSignIn { Either.Right(token) }

        assertEquals(listOf(token), auth.tokens)
        assertEquals(AuthKind.MEMBER, vm.uiState.value.kind)
    }

    @Test
    fun `closing the Google sheet changes nothing`() = runTest {
        val auth = FakeAuthRepository()
        val vm = viewModel(auth)

        vm.onSignIn { Either.Right(null) }

        assertTrue(auth.tokens.isEmpty())
        assertEquals(AuthKind.GUEST, vm.uiState.value.kind)
        assertNull(vm.uiState.value.error)
    }

    @Test
    fun `closing the sheet after a failure keeps the failure`() = runTest {
        val vm = viewModel(FakeAuthRepository())
        vm.onSignIn { Either.Left(AuthError.Network) }

        vm.onSignIn { Either.Right(null) }

        assertNotNull(vm.uiState.value.error)
    }

    @Test
    fun `a Google sheet failure keeps the guest and shows the error`() = runTest {
        val vm = viewModel(FakeAuthRepository())

        vm.onSignIn { Either.Left(AuthError.NoGoogleAccount) }

        assertEquals(AuthKind.GUEST, vm.uiState.value.kind)
        assertNotNull(vm.uiState.value.error)
    }

    @Test
    fun `a failed sign-in keeps the guest and shows the error`() = runTest {
        val vm = viewModel(FakeAuthRepository(signIn = Either.Left(AuthError.Network)))

        vm.onSignIn { Either.Right(token) }

        assertEquals(AuthKind.GUEST, vm.uiState.value.kind)
        assertTrue(vm.uiState.value.canSignIn)
        assertNotNull(vm.uiState.value.error)
    }

    @Test
    fun `a second tap while Google's sheet is open does nothing`() = runTest {
        val vm = viewModel(FakeAuthRepository())
        val sheet = CompletableDeferred<Unit>()
        var sheetsOpened = 0
        val request: suspend () -> Either<AuthError, IdToken?> = {
            sheetsOpened++
            sheet.await()
            Either.Right(null)
        }

        vm.onSignIn(requestToken = request)
        vm.onSignIn(requestToken = request)
        val running = vm.uiState.value
        sheet.complete(Unit)

        assertEquals(1, sheetsOpened)
        assertEquals(AuthKind.LOADING, running.kind)
        assertFalse(running.canSignIn || running.canSignOut)
        assertEquals(AuthKind.GUEST, vm.uiState.value.kind)
    }

    @Test
    fun `an action cancelled from outside does not leave the screen loading`() = runTest {
        val auth = FakeAuthRepository()
        val vm = viewModel(auth)

        vm.onSignIn { throw CancellationException("Task was cancelled") }

        assertEquals(AuthKind.GUEST, vm.uiState.value.kind)
        vm.onSignOut()
        assertEquals(1, auth.signOuts)
    }

    @Test
    fun `a cancelled sign-in keeps the failure that was showing`() = runTest {
        val vm = viewModel(FakeAuthRepository())
        vm.onSignIn { Either.Left(AuthError.Network) }

        vm.onSignIn { throw CancellationException("Task was cancelled") }

        assertNotNull(vm.uiState.value.error)
    }

    @Test
    fun `signing out ends the session and starts no guest`() = runTest {
        val auth = FakeAuthRepository(session = MEMBER_SESSION)
        val vm = viewModel(auth)

        vm.onSignOut()

        assertEquals(1, auth.signOuts)
        assertEquals(AuthKind.SIGNED_OUT, vm.uiState.value.kind)
        assertFalse(vm.uiState.value.canContinueAsGuest)
    }

    @Test
    fun `a member signing in again tells the screen, because no session change will`() = runTest {
        val vm = viewModel(FakeAuthRepository(session = MEMBER_SESSION))
        var told = 0

        vm.onSignIn(onSignedInAgain = { told++ }) { Either.Right(token) }

        assertEquals(1, told)
    }

    @Test
    fun `a member's good sign-in after a failed one still tells the screen`() = runTest {
        val auth = FakeAuthRepository(session = MEMBER_SESSION, signIn = Either.Left(AuthError.Network))
        val vm = viewModel(auth)
        var told = 0
        vm.onSignIn(onSignedInAgain = { told++ }) { Either.Right(token) }
        auth.signIn = Either.Right(Unit)

        vm.onSignIn(onSignedInAgain = { told++ }) { Either.Right(token) }

        assertEquals(1, told)
    }

    @Test
    fun `a guest's sign-in does not, because the session change will`() = runTest {
        val vm = viewModel(FakeAuthRepository())
        var told = 0

        vm.onSignIn(onSignedInAgain = { told++ }) { Either.Right(token) }

        assertEquals(0, told)
    }

    @Test
    fun `a failed or closed sign-in of a member does not`() = runTest {
        val vm = viewModel(FakeAuthRepository(session = MEMBER_SESSION, signIn = Either.Left(AuthError.Network)))
        var told = 0

        vm.onSignIn(onSignedInAgain = { told++ }) { Either.Right(token) }
        vm.onSignIn(onSignedInAgain = { told++ }) { Either.Right(null) }

        assertEquals(0, told)
    }

    private fun TestScope.viewModel(auth: FakeAuthRepository) = AuthViewModel(auth).also { vm ->
        backgroundScope.launch(dispatcher) { vm.uiState.collect {} }
    }
}
