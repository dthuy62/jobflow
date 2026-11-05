package me.dthuy.jobflow.data.auth

import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Session
import me.dthuy.jobflow.domain.auth.SessionObserver
import me.dthuy.jobflow.domain.auth.SignInMethod
import me.dthuy.jobflow.domain.auth.Uid
import me.dthuy.jobflow.testing.FakeAuthApi
import me.dthuy.jobflow.testing.FakeGuestLedger
import me.dthuy.jobflow.testing.FakeIdentityProvider
import me.dthuy.jobflow.testing.FakePendingLogin
import me.dthuy.jobflow.testing.GUEST_USER
import me.dthuy.jobflow.testing.LINKED_USER
import me.dthuy.jobflow.testing.OTHER_USER
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AuthenticationServiceImplTest {
    private val google = SignInMethod.Google(IdToken("token"))
    private val guestSession = Session.Guest(GUEST_USER.uid)
    private val signedOutFresh = Session.SignedOut(canStartGuest = true)

    private val identity = FakeIdentityProvider()
    private val api = FakeAuthApi()
    private val guests = FakeGuestLedger()
    private val pending = FakePendingLogin()
    private val seen = mutableListOf<Uid?>()
    private var observer = SessionObserver { seen += it }
    private var installationId: String? = "install_1"

    // The session

    @Test
    fun `the session is unknown until the provider answers`() = test {
        assertEquals(Session.Unknown, service().session.value)
        assertTrue(seen.isEmpty())
    }

    @Test
    fun `nobody signed in is signed out, and observers hear it`() = test {
        val service = service()

        identity.publish(null)

        assertEquals(signedOutFresh, service.session.value)
        assertEquals(listOf<Uid?>(null), seen)
    }

    @Test
    fun `a session that ends on its own tells observers`() = test {
        val service = service()
        identity.publish(OTHER_USER)

        identity.publish(null)

        assertEquals(signedOutFresh, service.session.value)
        assertNull(seen.last())
    }

    @Test
    fun `observers finish before anyone sees the new session`() = test {
        var sessionDuringObserver: Session? = null
        lateinit var service: AuthenticationServiceImpl
        observer = SessionObserver { sessionDuringObserver = service.session.value }
        service = service()
        identity.publish(GUEST_USER)

        identity.publish(OTHER_USER)

        assertEquals(guestSession, sessionDuringObserver)
    }

    @Test
    fun `a failing observer blocks neither the session nor other observers`() = test {
        val later = mutableListOf<Uid?>()
        val service = service(SessionObserver { error("broken") }, SessionObserver { later += it })

        identity.publish(GUEST_USER)

        assertEquals(guestSession, service.session.value)
        assertEquals(listOf<Uid?>(GUEST_USER.uid), later)
    }

    // Guest

    @Test
    fun `a guest counts only after the backend confirmed`() = test {
        val service = signedOutService()
        api.gate = CompletableDeferred()

        launch { service.signIn(SignInMethod.Guest) }
        val whileConfirming = service.session.value
        api.gate?.complete(Unit)

        assertEquals(signedOutFresh, whileConfirming)
        assertEquals(guestSession, service.session.value)
        assertEquals(1, api.guestCalls)
        assertNull(pending.running())
    }

    @Test
    fun `a guest the provider refuses changes nothing and never reaches the backend`() = test {
        val service = signedOutService()
        identity.guestFailure = AuthError.Network

        assertEquals(Either.Left(AuthError.Network), service.signIn(SignInMethod.Guest))

        assertEquals(0, api.guestCalls)
        assertEquals(0, identity.signOuts)
        assertEquals(signedOutFresh, service.session.value)
    }

    @Test
    fun `a guest the backend refuses is signed out on the device, and may try again`() = test {
        val service = signedOutService()
        api.failure = IOException("offline")

        assertEquals(Either.Left(AuthError.Network), service.signIn(SignInMethod.Guest))

        assertEquals(1, identity.signOuts)
        assertEquals(signedOutFresh, service.session.value)
        assertTrue(api.logouts.isEmpty())
        api.failure = null
        assertEquals(Either.Right(Unit), service.signIn(SignInMethod.Guest))
        assertEquals(guestSession, service.session.value)
    }

    @Test
    fun `once this install has had a guest, signing out leaves only Google`() = test {
        val service = signedOutService()
        service.signIn(SignInMethod.Guest)

        service.signOut()

        assertEquals(Session.SignedOut(canStartGuest = false), service.session.value)
        assertEquals(Either.Left(AuthError.GuestAlreadyUsed), service.signIn(SignInMethod.Guest))
    }

    @Test
    fun `starting a guest while signed in does nothing`() = test {
        val service = service()
        identity.publish(OTHER_USER)

        assertEquals(Either.Right(Unit), service.signIn(SignInMethod.Guest))

        assertEquals(0, api.guestCalls)
        assertEquals(Session.Member(OTHER_USER.uid), service.session.value)
    }

    // Google

    @Test
    fun `linking keeps the uid, sends no guest token, and clears nothing`() = test {
        val service = service()
        identity.publish(GUEST_USER)
        seen.clear()

        assertEquals(Either.Right(Unit), service.signIn(google))

        assertEquals(Session.Member(LINKED_USER.uid), service.session.value)
        assertNull(api.ssoRequests.single().guestToken)
        assertTrue(seen.isEmpty())
    }

    @Test
    fun `switching sends the guest token and tells observers the new uid`() = test {
        val service = switchingService()

        assertEquals(Either.Right(Unit), service.signIn(google))

        assertEquals(Session.Member(OTHER_USER.uid), service.session.value)
        assertEquals("guest_token", api.ssoRequests.single().guestToken)
        assertEquals(OTHER_USER.uid, seen.last())
        assertNull(pending.guestToken())
    }

    @Test
    fun `the session does not move until the backend confirmed the sign-in`() = test {
        val service = switchingService()
        seen.clear()
        api.gate = CompletableDeferred()

        launch { service.signIn(google) }
        val whileConfirming = service.session.value
        val observersWhileConfirming = seen.toList()
        api.gate?.complete(Unit)

        assertEquals(guestSession, whileConfirming)
        assertTrue(observersWhileConfirming.isEmpty())
        assertEquals(Session.Member(OTHER_USER.uid), service.session.value)
    }

    @Test
    fun `a provider failure leaves the session and never reaches the backend`() = test {
        val service = service()
        identity.publish(GUEST_USER)
        identity.googleFailure = AuthError.SignInFailed

        assertEquals(Either.Left(AuthError.SignInFailed), service.signIn(google))

        assertEquals(guestSession, service.session.value)
        assertTrue(api.ssoRequests.isEmpty())
        assertEquals(0, identity.signOuts)
    }

    @Test
    fun `a backend failure signs out on the device only`() = test {
        val service = switchingService()
        api.failure = IOException("offline")

        assertEquals(Either.Left(AuthError.Network), service.signIn(google))

        assertEquals(1, identity.signOuts)
        assertEquals(Session.SignedOut(canStartGuest = false), service.session.value)
        assertTrue(api.logouts.isEmpty())
        assertNull(pending.running())
    }

    @Test
    fun `the guest token survives a failed switch, so a retry can still merge`() = test {
        val service = switchingService()
        api.failure = IOException("offline")
        service.signIn(google)
        api.failure = null
        identity.guestTokenAtSwitch = null

        service.signIn(google)

        assertEquals("guest_token", api.ssoRequests.last().guestToken)
        assertNull(pending.guestToken())
    }

    @Test
    fun `the guest token is on disk even if the switch never finishes`() = test {
        val service = switchingService()
        identity.googleFailure = AuthError.Network

        service.signIn(google)

        assertEquals("guest_token", pending.guestToken())
        assertEquals(guestSession, service.session.value)
    }

    @Test
    fun `the mark is down before the provider is touched`() = test {
        val service = service()
        identity.publish(GUEST_USER)
        var mark: PendingSignIn? = null
        identity.onSignInStart = { mark = pending.running() }

        service.signIn(google)

        assertEquals(PendingSignIn.GOOGLE, mark)
    }

    @Test
    fun `a sign-in that cannot leave its mark does not start`() = test {
        val service = service()
        identity.publish(GUEST_USER)
        pending.canWrite = false

        assertEquals(Either.Left(AuthError.SignInFailed), service.signIn(google))

        assertTrue(identity.tokens.isEmpty())
        assertEquals(guestSession, service.session.value)
    }

    @Test
    fun `a sign-in cut off after the provider moved is rolled back before any session shows`() = test {
        pending.begin(PendingSignIn.GOOGLE)
        identity.currentUser = OTHER_USER

        val service = service()

        assertEquals(1, identity.signOuts)
        assertNull(pending.running())
        assertEquals(signedOutFresh, service.session.value)
        assertFalse(seen.contains(OTHER_USER.uid))
    }

    @Test
    fun `a Google sign-in cut off before the provider moved keeps the guest`() = test {
        guests.markUsed()
        pending.begin(PendingSignIn.GOOGLE)
        identity.currentUser = GUEST_USER

        val service = service()
        identity.publish(GUEST_USER)

        assertEquals(0, identity.signOuts)
        assertNull(pending.running())
        assertEquals(guestSession, service.session.value)
    }

    @Test
    fun `a guest sign-in cut off before the backend confirmed is rolled back`() = test {
        pending.begin(PendingSignIn.GUEST)
        identity.currentUser = GUEST_USER

        val service = service()

        assertEquals(1, identity.signOuts)
        assertEquals(signedOutFresh, service.session.value)
    }

    @Test
    fun `a cancelled provider task leaves no mark, so the next launch signs nobody out`() = test {
        val service = service()
        identity.publish(GUEST_USER)
        identity.onSignInStart = { throw CancellationException("Task was cancelled") }

        launch { runCatching { service.signIn(google) } }

        assertNull(pending.running())
        assertEquals(guestSession, service.session.value)
    }

    // Running commands

    @Test
    fun `busy shows while a command runs, and ends even when it fails`() = test {
        val service = service()
        identity.publish(GUEST_USER)
        api.gate = CompletableDeferred()
        api.failure = IOException("offline")

        launch { service.signIn(google) }
        val whileRunning = service.isBusy.value
        api.gate?.complete(Unit)

        assertTrue(whileRunning)
        assertFalse(service.isBusy.value)
    }

    @Test
    fun `a caller going away does not cut the sign-in`() = test {
        val service = switchingService()
        api.gate = CompletableDeferred()

        val caller = launch { service.signIn(google) }
        caller.cancel()
        api.gate?.complete(Unit)

        assertEquals(Session.Member(OTHER_USER.uid), service.session.value)
        assertNull(pending.running())
    }

    @Test
    fun `commands run one at a time`() = test {
        val service = service()
        identity.publish(GUEST_USER)
        api.gate = CompletableDeferred()

        launch { service.signIn(google) }
        launch { service.signOut() }
        val logoutsWhileSigningIn = api.logouts.size
        val signOutsWhileSigningIn = identity.signOuts
        api.gate?.complete(Unit)

        assertEquals(0, logoutsWhileSigningIn)
        assertEquals(0, signOutsWhileSigningIn)
        assertEquals(1, identity.signOuts)
    }

    // Signing out

    @Test
    fun `signing out tells the backend, then ends the session, and starts no guest`() = test {
        val service = service()
        identity.publish(OTHER_USER)
        var signOutsAtLogout = -1
        api.onLogout = { signOutsAtLogout = identity.signOuts }

        service.signOut()

        // The call needs the token, so it must go first.
        assertEquals(0, signOutsAtLogout)
        assertEquals(listOf("install_1"), api.logouts)
        assertEquals(1, identity.signOuts)
        assertEquals(signedOutFresh, service.session.value)
        assertEquals(0, api.guestCalls)
    }

    @Test
    fun `signing out forgets a kept guest token, so the next person cannot merge it`() = test {
        val service = service()
        identity.publish(OTHER_USER)
        pending.keepGuestToken("guest_token")

        service.signOut()

        assertNull(pending.guestToken())
    }

    @Test
    fun `signing out works when the backend fails`() = test {
        val service = service()
        identity.publish(OTHER_USER)
        api.failure = IOException("offline")

        service.signOut()

        assertEquals(signedOutFresh, service.session.value)
    }

    @Test
    fun `signing out works without an installation id`() = test {
        installationId = null
        val service = service()
        identity.publish(OTHER_USER)

        service.signOut()

        assertTrue(api.logouts.isEmpty())
        assertEquals(1, identity.signOuts)
    }

    // A session the provider rejects

    @Test
    fun `a rejected user is signed out`() = test {
        val service = service()
        identity.publish(OTHER_USER)

        identity.reject(OTHER_USER.uid)

        assertEquals(signedOutFresh, service.session.value)
    }

    @Test
    fun `a rejection about a user already replaced is ignored`() = test {
        val service = service()
        identity.publish(OTHER_USER)

        identity.reject(GUEST_USER.uid)

        assertEquals(Session.Member(OTHER_USER.uid), service.session.value)
        assertEquals(0, identity.signOuts)
    }

    @Test
    fun `a rejection waits for a running sign-in`() = test {
        val service = service()
        identity.publish(GUEST_USER)
        api.gate = CompletableDeferred()

        launch { service.signIn(google) }
        identity.reject(LINKED_USER.uid)
        val signOutsWhileSigningIn = identity.signOuts
        api.gate?.complete(Unit)

        assertEquals(0, signOutsWhileSigningIn)
        assertEquals(1, identity.signOuts)
    }

    private fun test(block: suspend TestScope.() -> Unit) = runTest(UnconfinedTestDispatcher(), testBody = block)

    private suspend fun TestScope.signedOutService() = service().also { identity.publish(null) }

    private suspend fun TestScope.switchingService() = service().also {
        identity.publish(GUEST_USER)
        identity.userAfterGoogle = OTHER_USER
        identity.guestTokenAtSwitch = "guest_token"
    }

    private fun TestScope.service(vararg observers: SessionObserver): AuthenticationServiceImpl =
        AuthenticationServiceImpl(
            identity,
            GuestSignIn(identity, api),
            GoogleSignIn(identity, api, pending),
            api,
            { installationId },
            guests,
            pending,
            if (observers.isEmpty()) setOf(SessionObserver { observer.onUserChanged(it) }) else observers.toSet(),
            CoroutineScope(backgroundScope.coroutineContext + UnconfinedTestDispatcher(testScheduler)),
        )
}
