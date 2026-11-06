package me.dthuy.jobflow.data.auth

import java.io.IOException
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
import me.dthuy.jobflow.domain.auth.UserId
import me.dthuy.jobflow.testing.FIXED_CLOCK
import me.dthuy.jobflow.testing.FakeAuthApi
import me.dthuy.jobflow.testing.FakeGuestLedger
import me.dthuy.jobflow.testing.FakeIdentityProvider
import me.dthuy.jobflow.testing.FakeSessionStore
import me.dthuy.jobflow.testing.GUEST_ID
import me.dthuy.jobflow.testing.MEMBER_ID
import me.dthuy.jobflow.testing.storedSession
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class AuthenticationServiceImplTest {
    private val google = SignInMethod.Google(IdToken("google"))
    private val signedOutFresh = Session.SignedOut(canStartGuest = true)

    private val store = FakeSessionStore()
    private val identity = FakeIdentityProvider()
    private val api = FakeAuthApi()
    private val guests = FakeGuestLedger()
    private val tokens = SessionTokens(store, { api }, FIXED_CLOCK)
    private val seen = mutableListOf<UserId?>()
    private var observer = SessionObserver { seen += it }
    private var installationId: String? = "install_1"

    // The session

    @Test
    fun `nothing stored is signed out, and observers hear it`() = test {
        val service = service()

        assertEquals(signedOutFresh, service.session.value)
        assertEquals(listOf<UserId?>(null), seen)
    }

    @Test
    fun `a stored guest or member is restored offline`() = test {
        store.session = storedSession(GUEST_ID, isGuest = true)
        assertEquals(Session.Guest(GUEST_ID), service().session.value)

        store.session = storedSession(MEMBER_ID, isGuest = false)
        assertEquals(Session.Member(MEMBER_ID), service().session.value)
    }

    @Test
    fun `observers finish before anyone sees the new session`() = test {
        var sessionDuringObserver: Session? = null
        lateinit var service: AuthenticationServiceImpl
        service = service(SessionObserver { if (it != null) sessionDuringObserver = service.session.value })

        service.signIn(SignInMethod.Guest)

        assertEquals(signedOutFresh, sessionDuringObserver)
    }

    @Test
    fun `a failing observer blocks neither the session nor other observers`() = test {
        val service = service(SessionObserver { error("broken") }, SessionObserver { seen += it })

        service.signIn(SignInMethod.Guest)

        assertEquals(Session.Guest(GUEST_ID), service.session.value)
        assertEquals(GUEST_ID, seen.last())
    }

    @Test
    fun `a session the backend ends is signed out, and observers hear it`() = test {
        store.session = storedSession(MEMBER_ID, isGuest = false, expiresAt = 0)
        api.refreshAnswer = { Response.error(401, "".toResponseBody(null)) }
        val service = service()

        tokens.accessToken()

        assertEquals(signedOutFresh, service.session.value)
        assertNull(seen.last())
    }

    // A guest

    @Test
    fun `a guest is kept, marked, and shown`() = test {
        val service = service()

        val result = service.signIn(SignInMethod.Guest)

        assertEquals(Either.Right(Unit), result)
        assertEquals(Session.Guest(GUEST_ID), service.session.value)
        assertEquals(GUEST_ID, store.session?.userId)
        assertTrue(guests.isUsed())
    }

    @Test
    fun `a guest the backend refuses changes nothing, and may try again`() = test {
        val service = service()
        api.failure = IOException("offline")

        val result = service.signIn(SignInMethod.Guest)

        assertEquals(Either.Left(AuthError.Network), result)
        assertEquals(signedOutFresh, service.session.value)
        assertFalse(guests.isUsed())
    }

    @Test
    fun `a guest that cannot be kept fails, and nothing shows`() = test {
        val service = service()
        store.canWrite = false

        val result = service.signIn(SignInMethod.Guest)

        assertEquals(Either.Left(AuthError.SignInFailed), result)
        assertEquals(signedOutFresh, service.session.value)
    }

    @Test
    fun `once this install has had a guest, only Google is left`() = test {
        guests.markUsed()
        val service = service()

        val result = service.signIn(SignInMethod.Guest)

        assertEquals(Either.Left(AuthError.GuestAlreadyUsed), result)
        assertEquals(Session.SignedOut(canStartGuest = false), service.session.value)
        assertEquals(0, api.guestCalls)
    }

    @Test
    fun `a guest that cannot be read is not replaced by a new one`() = test {
        val guest = storedSession(GUEST_ID, isGuest = true)
        store.session = guest
        val service = service()
        store.canRead = false

        val result = service.signIn(SignInMethod.Guest)

        assertEquals(Either.Left(AuthError.SignInFailed), result)
        assertEquals(0, api.guestCalls)
        assertEquals(guest, store.session)
        assertEquals(Session.Guest(GUEST_ID), service.session.value)
        assertEquals(listOf<UserId?>(GUEST_ID), seen)
    }

    @Test
    fun `a guest that cannot be read is not signed in over without their data`() = test {
        val guest = storedSession(GUEST_ID, isGuest = true)
        store.session = guest
        val service = service()
        store.canRead = false

        val result = service.signIn(google)

        assertEquals(Either.Left(AuthError.SignInFailed), result)
        assertTrue(api.ssoRequests.isEmpty())
        assertEquals(guest, store.session)
        assertEquals(Session.Guest(GUEST_ID), service.session.value)
        assertEquals(listOf<UserId?>(GUEST_ID), seen)
    }

    @Test
    fun `starting a guest while signed in does nothing`() = test {
        store.session = storedSession(MEMBER_ID, isGuest = false)
        val service = service()

        assertEquals(Either.Right(Unit), service.signIn(SignInMethod.Guest))
        assertEquals(0, api.guestCalls)
    }

    @Test
    fun `a guest cannot sign out, because it would lose their data`() = test {
        store.session = storedSession(GUEST_ID, isGuest = true)
        val service = service()

        service.signOut()

        assertEquals(Session.Guest(GUEST_ID), service.session.value)
        assertTrue(api.logouts.isEmpty())
    }

    // Google

    @Test
    fun `Google sends the provider's token, keeps the member and signs out of nothing else`() = test {
        val service = service()

        val result = service.signIn(google)

        assertEquals(Either.Right(Unit), result)
        assertEquals("firebase_google", api.ssoRequests.single().idToken)
        assertNull(api.ssoRequests.single().guestRefreshToken)
        assertEquals(Session.Member(MEMBER_ID), service.session.value)
        assertEquals(MEMBER_ID, store.session?.userId)
    }

    @Test
    fun `a guest signing in sends their refresh token, so the backend moves their data`() = test {
        store.session = storedSession(GUEST_ID, isGuest = true)
        val service = service()

        service.signIn(google)

        assertEquals("refresh_${GUEST_ID.value}", api.ssoRequests.single().guestRefreshToken)
        assertEquals(Session.Member(MEMBER_ID), service.session.value)
        assertEquals(listOf(GUEST_ID, MEMBER_ID), seen)
    }

    @Test
    fun `a member signing in again sends no guest token`() = test {
        store.session = storedSession(MEMBER_ID, isGuest = false)
        val service = service()

        service.signIn(google)

        assertNull(api.ssoRequests.single().guestRefreshToken)
    }

    @Test
    fun `a backend failure keeps the guest as they were, and a retry sends the same token`() = test {
        val guest = storedSession(GUEST_ID, isGuest = true)
        store.session = guest
        val service = service()
        api.failure = IOException("offline")

        val result = service.signIn(google)

        assertEquals(Either.Left(AuthError.Network), result)
        assertEquals(guest, store.session)
        assertEquals(Session.Guest(GUEST_ID), service.session.value)

        api.failure = null
        service.signIn(google)
        assertEquals(guest.refreshToken, api.ssoRequests.last().guestRefreshToken)
        assertEquals(Session.Member(MEMBER_ID), service.session.value)
    }

    @Test
    fun `a provider failure never reaches the backend`() = test {
        store.session = storedSession(GUEST_ID, isGuest = true)
        val service = service()
        identity.failure = AuthError.AccountDisabled

        val result = service.signIn(google)

        assertEquals(Either.Left(AuthError.AccountDisabled), result)
        assertTrue(api.ssoRequests.isEmpty())
        assertEquals(Session.Guest(GUEST_ID), service.session.value)
    }

    @Test
    fun `a member that cannot be kept fails, and the guest stays`() = test {
        store.session = storedSession(GUEST_ID, isGuest = true)
        val service = service()
        store.canWrite = false

        val result = service.signIn(google)

        assertEquals(Either.Left(AuthError.SignInFailed), result)
        assertEquals(Session.Guest(GUEST_ID), service.session.value)
    }

    // Running commands

    @Test
    fun `busy shows while a command runs, and ends even when it fails`() = test {
        val service = service()
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
        val service = service()
        api.gate = CompletableDeferred()

        val caller = launch { service.signIn(google) }
        caller.cancel()
        api.gate?.complete(Unit)

        assertEquals(Session.Member(MEMBER_ID), service.session.value)
    }

    @Test
    fun `commands run one at a time`() = test {
        store.session = storedSession(MEMBER_ID, isGuest = false)
        val service = service()
        api.gate = CompletableDeferred()

        launch { service.signIn(google) }
        launch { service.signOut() }
        val logoutsWhileSigningIn = api.logouts.size
        api.gate?.complete(Unit)

        assertEquals(0, logoutsWhileSigningIn)
        assertEquals(1, api.logouts.size)
    }

    // Signing out

    @Test
    fun `signing out tells the backend first, then forgets the session, and starts no guest`() = test {
        store.session = storedSession(MEMBER_ID, isGuest = false)
        val service = service()
        var storedAtLogout: StoredSession? = null
        api.onLogout = { storedAtLogout = store.session }

        service.signOut()

        // The call needs the access token, so it must go first.
        assertEquals(MEMBER_ID, storedAtLogout?.userId)
        assertEquals(listOf("install_1"), api.logouts)
        assertNull(store.session)
        assertEquals(1, identity.signOuts)
        assertEquals(signedOutFresh, service.session.value)
        assertEquals(0, api.guestCalls)
    }

    @Test
    fun `signing out works when the backend fails`() = test {
        store.session = storedSession(MEMBER_ID, isGuest = false)
        val service = service()
        api.failure = IOException("offline")

        service.signOut()

        assertEquals(signedOutFresh, service.session.value)
    }

    @Test
    fun `signing out works without an installation id`() = test {
        installationId = null
        store.session = storedSession(MEMBER_ID, isGuest = false)
        val service = service()

        service.signOut()

        assertTrue(api.logouts.isEmpty())
        assertEquals(signedOutFresh, service.session.value)
    }

    private fun test(block: suspend TestScope.() -> Unit) = runTest(UnconfinedTestDispatcher(), testBody = block)

    private fun TestScope.service(vararg observers: SessionObserver): AuthenticationServiceImpl =
        AuthenticationServiceImpl(
            store,
            tokens,
            GuestSignIn(api, FIXED_CLOCK),
            GoogleSignIn(identity, api, FIXED_CLOCK),
            identity,
            BackendLogout(api) { installationId },
            guests,
            if (observers.isEmpty()) setOf(SessionObserver { observer.onUserChanged(it) }) else observers.toSet(),
            CoroutineScope(backgroundScope.coroutineContext + UnconfinedTestDispatcher(testScheduler)),
        )
}
