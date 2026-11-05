package me.dthuy.jobflow.data.auth

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
import me.dthuy.jobflow.domain.auth.Uid
import me.dthuy.jobflow.testing.FakeIdentityProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AuthRepositoryImplTest {
    private val guestUid = Uid("uid_guest")
    private val otherUid = Uid("uid_other")
    private val guest = IdentityUser(guestUid, isAnonymous = true)
    private val linked = IdentityUser(guestUid, isAnonymous = false)
    private val other = IdentityUser(otherUid, isAnonymous = false)
    private val token = IdToken("token")

    private val identity = FakeIdentityProvider()
    private val guests = FakeGuestLedger()
    private val seen = mutableListOf<Uid?>()
    private var observer = SessionObserver { seen += it }

    @Test
    fun `the session is unknown until the identity service answers`() = runTest {
        assertEquals(Session.Unknown, repository().session.value)
        assertTrue(seen.isEmpty())
    }

    @Test
    fun `nobody signed in is signed out, and observers hear it`() = runTest {
        val repository = repository()

        identity.publish(null)

        assertEquals(Session.SignedOut(canStartGuest = true), repository.session.value)
        assertEquals(listOf<Uid?>(null), seen)
    }

    @Test
    fun `an anonymous user is a guest`() = runTest {
        val repository = repository()

        identity.publish(guest)

        assertEquals(Session.Guest(guestUid), repository.session.value)
    }

    @Test
    fun `linking Google keeps the uid and becomes a member`() = runTest {
        val repository = repository()
        identity.publish(guest)

        identity.publish(linked)

        assertEquals(Session.Member(guestUid), repository.session.value)
        assertEquals(listOf<Uid?>(guestUid, guestUid), seen)
    }

    @Test
    fun `switching to an existing Google account tells observers the new uid`() = runTest {
        val repository = repository()
        identity.publish(guest)

        identity.publish(other)

        assertEquals(Session.Member(otherUid), repository.session.value)
        assertEquals(otherUid, seen.last())
    }

    @Test
    fun `a session that ends on its own tells observers`() = runTest {
        val repository = repository()
        identity.publish(other)

        identity.publish(null)

        assertEquals(Session.SignedOut(canStartGuest = true), repository.session.value)
        assertEquals(null, seen.last())
    }

    @Test
    fun `observers finish before anyone sees the new session`() = runTest {
        var sessionDuringObserver: Session? = null
        lateinit var repository: AuthRepositoryImpl
        observer = SessionObserver { sessionDuringObserver = repository.session.value }
        repository = repository()
        identity.publish(guest)

        identity.publish(other)

        assertEquals(Session.Guest(guestUid), sessionDuringObserver)
    }

    @Test
    fun `a failing observer blocks neither the session nor other observers`() = runTest {
        val later = mutableListOf<Uid?>()
        val repository = repository(
            SessionObserver { throw IllegalStateException("broken") },
            SessionObserver { later += it },
        )

        identity.publish(guest)

        assertEquals(Session.Guest(guestUid), repository.session.value)
        assertEquals(listOf<Uid?>(guestUid), later)
    }

    @Test
    fun `a failed command returns its error and leaves the session`() = runTest {
        val repository = repository()
        identity.publish(guest)
        identity.result = Either.Left(AuthError.Network)

        val result = repository.signInWithGoogle(token)

        assertEquals(Either.Left(AuthError.Network), result)
        assertEquals(Session.Guest(guestUid), repository.session.value)
    }

    @Test
    fun `commands run one at a time`() = runTest(UnconfinedTestDispatcher()) {
        val repository = repository()
        val gate = CompletableDeferred<Unit>()
        identity.gate = gate

        launch { repository.signInWithGoogle(token) }
        launch { repository.signOut() }
        val signOutsWhileSigningIn = identity.signOuts
        gate.complete(Unit)

        assertEquals(0, signOutsWhileSigningIn)
        assertEquals(1, identity.signOuts)
    }

    @Test
    fun `a guest on a new install starts`() = runTest {
        val repository = repository()
        identity.publish(null)

        assertEquals(Either.Right(Unit), repository.continueAsGuest())

        assertEquals(1, identity.guestSignIns)
    }

    @Test
    fun `once this install has had a guest, signing out leaves only Google`() = runTest {
        val repository = repository()
        identity.publish(guest)
        identity.publish(linked)

        identity.publish(null)

        assertEquals(Session.SignedOut(canStartGuest = false), repository.session.value)
        assertEquals(Either.Left(AuthError.GuestAlreadyUsed), repository.continueAsGuest())
        assertEquals(0, identity.guestSignIns)
    }

    @Test
    fun `a used guest is remembered across app restarts`() = runTest {
        guests.markUsed()
        val repository = repository()

        identity.publish(null)

        assertEquals(Session.SignedOut(canStartGuest = false), repository.session.value)
    }

    @Test
    fun `continuing while already a guest is not refused`() = runTest {
        val repository = repository()
        identity.publish(guest)

        assertEquals(Either.Right(Unit), repository.continueAsGuest())
    }

    @Test
    fun `a Google user on a new install does not use up the guest`() = runTest {
        val repository = repository()
        identity.publish(other)

        identity.publish(null)

        assertEquals(Session.SignedOut(canStartGuest = true), repository.session.value)
    }

    private fun TestScope.repository(vararg observers: SessionObserver) = AuthRepositoryImpl(
        identity,
        guests,
        // Reads the field late, so a test can set the observer after creating the repository's dependencies.
        if (observers.isEmpty()) setOf(SessionObserver { observer.onSessionChanged(it) }) else observers.toSet(),
        CoroutineScope(backgroundScope.coroutineContext + UnconfinedTestDispatcher(testScheduler)),
    )

    private class FakeGuestLedger : GuestLedger {
        private var used = false

        override fun isUsed() = used

        override fun markUsed() {
            used = true
        }
    }
}
