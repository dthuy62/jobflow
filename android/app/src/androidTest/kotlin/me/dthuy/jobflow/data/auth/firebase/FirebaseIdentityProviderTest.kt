package me.dthuy.jobflow.data.auth.firebase

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.data.auth.GuestTokenKeeper
import me.dthuy.jobflow.data.auth.IdentityUser
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Uid
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

private const val EMULATOR_HOST = "10.0.2.2"
private const val EMULATOR_PORT = 9099

// The project the emulator was started with, which is where it keeps users whatever the app's config says.
private const val EMULATOR_PROJECT = "demo-jobflow"
private const val TIMEOUT_MS = 15_000L

/**
 * Runs the real Firebase SDK against the local Auth emulator, for what a fake cannot prove: which changes the listener
 * reports, and what linking and a deleted account really do. Start it with `firebase emulators:start --only auth
 * --project demo-jobflow` from `android/`, then run `./gradlew connectedDevDebugAndroidTest`.
 */
@RunWith(AndroidJUnit4::class)
class FirebaseIdentityProviderTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
    private val provider = FirebaseIdentityProvider(auth, context)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    @Before
    fun setUp() {
        if (!emulatorConnected) {
            auth.useEmulator(EMULATOR_HOST, EMULATOR_PORT)
            emulatorConnected = true
        }
        auth.signOut()
        admin("DELETE", "/emulator/v1/projects/$EMULATOR_PROJECT/accounts")
    }

    @After
    fun tearDown() = scope.cancel()

    @Test
    fun nobody_signed_in_is_reported_right_after_listening() = runBlocking {
        assertNull(within { provider.user.first() })
    }

    @Test
    fun asking_for_a_token_never_creates_a_user() {
        assertNull(provider.idToken(forceRefresh = false))
        assertNull(auth.currentUser)
    }

    @Test
    fun a_new_guest_is_reported_to_someone_already_listening() = runBlocking {
        val seen = listening()

        assertEquals(Either.Right(Unit), provider.startGuest())

        val guest = within { seen.first { it.lastOrNull() != null } }.last()
        assertEquals(true, guest?.isAnonymous)
    }

    @Test
    fun linking_google_keeps_the_uid_and_is_reported_while_listening() = runBlocking {
        provider.startGuest()
        val guestUid = auth.uid!!
        val seen = listening()

        val tokens = RecordingKeeper()

        assertEquals(Either.Right(Unit), provider.signInWithGoogle(googleToken("linked"), tokens))

        assertNull(tokens.kept)

        val latest = within { seen.first { it.lastOrNull()?.isAnonymous == false } }.last()
        assertEquals(IdentityUser(Uid(guestUid), isAnonymous = false), latest)
    }

    @Test
    fun a_google_account_already_used_here_switches_and_reports_the_new_uid() = runBlocking {
        val existingUid = existingGoogleUser("existing")
        provider.startGuest()
        val seen = listening()

        val tokens = RecordingKeeper()

        assertEquals(Either.Right(Unit), provider.signInWithGoogle(googleToken("existing"), tokens))

        assertNotNull(tokens.kept)
        assertEquals(Uid(existingUid), tokens.boundTo)

        val latest = within { seen.first { it.lastOrNull()?.uid == Uid(existingUid) } }.last()
        assertEquals(IdentityUser(Uid(existingUid), isAnonymous = false), latest)
    }

    @Test
    fun a_disabled_google_account_fails_and_keeps_the_guest() = runBlocking {
        val disabledUid = existingGoogleUser("disabled")
        disable(disabledUid)
        provider.startGuest()
        val guestUid = auth.uid

        val result = provider.signInWithGoogle(googleToken("disabled"), RecordingKeeper())

        assertEquals(Either.Left(AuthError.AccountDisabled), result)
        assertEquals(guestUid, auth.uid)
    }

    // A deleted account is not tested here: the emulator answers INVALID_REFRESH_TOKEN, not the documented invalid-user error.
    @Test
    fun an_account_disabled_elsewhere_is_reported_when_the_token_refreshes() = runBlocking {
        provider.signInWithGoogle(googleToken("disabled_later"), RecordingKeeper())
        val uid = auth.uid!!
        val rejected = scope.async(start = CoroutineStart.UNDISPATCHED) { provider.rejected.first() }
        disable(uid)

        assertNull(provider.idToken(forceRefresh = true))

        assertEquals(Uid(uid), within { rejected.await() })
    }

    @Test
    fun signing_out_is_reported_and_starts_no_guest() = runBlocking {
        provider.signInWithGoogle(googleToken("leaving"), RecordingKeeper())
        val seen = listening()

        provider.signOut()

        assertNull(within { seen.first { it.lastOrNull() == null } }.last())
        assertNull(auth.currentUser)
        assertFalse(seen.value.isEmpty())
    }

    // Returns once the listener has answered, so the changes that follow are live reports, not the first answer.
    private suspend fun listening(): MutableStateFlow<List<IdentityUser?>> {
        val seen = MutableStateFlow(emptyList<IdentityUser?>())
        scope.launch { provider.user.collect { user -> seen.value += user } }
        within { seen.first { it.isNotEmpty() } }
        return seen
    }

    private suspend fun existingGoogleUser(name: String): String {
        val credential = GoogleAuthProvider.getCredential(googleToken(name).value, null)
        val uid = auth.signInWithCredential(credential).await().user!!.uid
        auth.signOut()
        return uid
    }

    /** The emulator accepts this JSON in place of a signed Google token. */
    private fun googleToken(name: String) =
        IdToken("""{"sub":"$name","email":"$name@example.com","email_verified":true}""")

    private fun disable(uid: String) = admin(
        "POST",
        "/identitytoolkit.googleapis.com/v1/projects/$EMULATOR_PROJECT/accounts:update",
        """{"localId":"$uid","disableUser":true}""",
    )

    private fun admin(method: String, path: String, body: String? = null) {
        val connection = URL("http://$EMULATOR_HOST:$EMULATOR_PORT$path").openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.setRequestProperty("Authorization", "Bearer owner")
        if (body != null) {
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write(body.toByteArray()) }
        }
        check(connection.responseCode == HttpURLConnection.HTTP_OK) { "Emulator answered ${connection.responseCode}" }
        connection.disconnect()
    }

    private suspend fun <T> within(block: suspend () -> T): T = withTimeout(TIMEOUT_MS) { block() }

    private class RecordingKeeper : GuestTokenKeeper {
        var kept: String? = null
        var boundTo: Uid? = null

        override suspend fun keepGuestToken(token: String) {
            kept = token
        }

        override suspend fun bindGuestToken(uid: Uid) {
            boundTo = uid
        }
    }

    private companion object {
        // The SDK refuses a second useEmulator call on the same instance once it has been used.
        var emulatorConnected = false
    }
}
