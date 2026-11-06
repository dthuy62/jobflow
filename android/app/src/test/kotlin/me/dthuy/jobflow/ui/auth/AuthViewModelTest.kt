package me.dthuy.jobflow.ui.auth

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Session
import me.dthuy.jobflow.domain.auth.SignInMethod
import me.dthuy.jobflow.testing.FakeAuthenticationService
import me.dthuy.jobflow.testing.MEMBER_ID
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AuthViewModelTest {
    private val token = IdToken("token")
    private val member = Session.Member(MEMBER_ID)

    @Before
    fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun AuthViewModel.signIn(requestToken: suspend () -> Either<AuthError, IdToken?>) =
        onIntent(AuthIntent.SignInWithGoogle(requestToken))

    @Test
    fun `the session reaches the screen, also when it changes elsewhere`() = runTest {
        val service = FakeAuthenticationService()
        val vm = AuthViewModel(service)
        assertEquals(AuthKind.GUEST, vm.state.value.kind)

        service.publish(Session.SignedOut(canStartGuest = false))

        assertEquals(AuthKind.SIGNED_OUT, vm.state.value.kind)
    }

    @Test
    fun `continuing as a guest asks the service for a guest`() = runTest {
        val service = FakeAuthenticationService(Session.SignedOut(canStartGuest = true))
        val vm = AuthViewModel(service)

        vm.onIntent(AuthIntent.ContinueAsGuest)

        assertEquals(listOf<SignInMethod>(SignInMethod.Guest), service.methods)
        assertEquals(AuthKind.GUEST, vm.state.value.kind)
    }

    @Test
    fun `a failure to start a guest shows`() = runTest {
        val service = FakeAuthenticationService(
            Session.SignedOut(canStartGuest = false),
            result = Either.Left(AuthError.GuestAlreadyUsed),
        )
        val vm = AuthViewModel(service)

        vm.onIntent(AuthIntent.ContinueAsGuest)

        assertEquals(AuthError.GuestAlreadyUsed.toUiError(), vm.state.value.error)
    }

    @Test
    fun `signing in passes Google's token to the service`() = runTest {
        val service = FakeAuthenticationService()
        val vm = AuthViewModel(service)

        vm.signIn { Either.Right(token) }

        assertEquals(listOf<SignInMethod>(SignInMethod.Google(token)), service.methods)
        assertEquals(AuthKind.MEMBER, vm.state.value.kind)
    }

    @Test
    fun `closing the sheet changes nothing`() = runTest {
        val service = FakeAuthenticationService()
        val vm = AuthViewModel(service)

        vm.signIn { Either.Right(null) }

        assertTrue(service.methods.isEmpty())
        assertEquals(AuthKind.GUEST, vm.state.value.kind)
        assertNull(vm.state.value.error)
    }

    @Test
    fun `closing the sheet after a failure keeps the failure`() = runTest {
        val vm = AuthViewModel(FakeAuthenticationService())
        vm.signIn { Either.Left(AuthError.NoGoogleAccount) }

        vm.signIn { Either.Right(null) }

        assertNotNull(vm.state.value.error)
    }

    @Test
    fun `a sheet failure shows and reaches no service`() = runTest {
        val service = FakeAuthenticationService()
        val vm = AuthViewModel(service)

        vm.signIn { Either.Left(AuthError.NoGoogleAccount) }

        assertTrue(service.methods.isEmpty())
        assertEquals(AuthError.NoGoogleAccount.toUiError(), vm.state.value.error)
    }

    @Test
    fun `a failed sign-in shows, and a member can try again`() = runTest {
        val service = FakeAuthenticationService(member, result = Either.Left(AuthError.Network))
        val vm = AuthViewModel(service)

        vm.signIn { Either.Right(token) }

        assertEquals(AuthError.Network.toUiError(), vm.state.value.error)
        assertTrue(vm.state.value.canSignIn)
    }

    @Test
    fun `a good sign-in clears the earlier failure`() = runTest {
        val service = FakeAuthenticationService(result = Either.Left(AuthError.Network))
        val vm = AuthViewModel(service)
        vm.signIn { Either.Right(token) }
        service.result = Either.Right(Unit)

        vm.signIn { Either.Right(token) }

        assertNull(vm.state.value.error)
    }

    @Test
    fun `a second tap while the sheet is open does nothing`() = runTest {
        val vm = AuthViewModel(FakeAuthenticationService())
        val sheet = CompletableDeferred<Unit>()
        var sheetsOpened = 0
        val request: suspend () -> Either<AuthError, IdToken?> = {
            sheetsOpened++
            sheet.await()
            Either.Right(null)
        }

        vm.signIn(request)
        vm.signIn(request)
        val running = vm.state.value
        sheet.complete(Unit)

        assertEquals(1, sheetsOpened)
        assertEquals(AuthState(), running)
        assertEquals(AuthKind.GUEST, vm.state.value.kind)
    }

    @Test
    fun `it stays loading from the sheet through the sign-in, with no gap`() = runTest {
        val service = FakeAuthenticationService()
        val gate = CompletableDeferred<Unit>()
        service.gate = gate
        val vm = AuthViewModel(service)
        val kinds = mutableListOf<AuthKind>()
        val collector = CoroutineScope(Dispatchers.Main).launchCollect(vm) { kinds += it.kind }

        vm.signIn { Either.Right(token) }
        gate.complete(Unit)
        collector.cancel()

        assertEquals(listOf(AuthKind.GUEST, AuthKind.LOADING, AuthKind.MEMBER), kinds.distinct())
    }

    @Test
    fun `a command running on another screen shows here and blocks here`() = runTest {
        val service = FakeAuthenticationService()
        val vm = AuthViewModel(service)
        var sheetsOpened = 0

        service.setBusy(true)
        vm.signIn {
            sheetsOpened++
            Either.Right(null)
        }
        vm.onIntent(AuthIntent.SignOut)

        assertEquals(AuthKind.LOADING, vm.state.value.kind)
        assertEquals(0, sheetsOpened)
        assertEquals(0, service.signOuts)
    }

    @Test
    fun `a sheet cancelled from outside does not leave the screen loading`() = runTest {
        val vm = AuthViewModel(FakeAuthenticationService())

        vm.signIn { throw CancellationException("Task was cancelled") }

        assertEquals(AuthKind.GUEST, vm.state.value.kind)
    }

    @Test
    fun `signing out asks the service and clears the failure`() = runTest {
        val service = FakeAuthenticationService(member, result = Either.Left(AuthError.Network))
        val vm = AuthViewModel(service)
        vm.signIn { Either.Right(token) }

        vm.onIntent(AuthIntent.SignOut)

        assertEquals(1, service.signOuts)
        assertEquals(AuthKind.SIGNED_OUT, vm.state.value.kind)
        assertNull(vm.state.value.error)
    }

    private fun CoroutineScope.launchCollect(vm: AuthViewModel, onState: (AuthState) -> Unit) =
        launch { vm.state.collect(onState) }
}
