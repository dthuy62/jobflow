package me.dthuy.jobflow.data.auth.firebase

import android.content.Context
import android.util.Base64
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withTimeout
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

private const val EMULATOR_HOST = "10.0.2.2"
private const val EMULATOR_PORT = 9099

// The project the emulator was started with, which is where it keeps users whatever the app's config says.
private const val EMULATOR_PROJECT = "demo-jobflow"
private const val TIMEOUT_MS = 15_000L

/**
 * Runs the real Firebase SDK against the local Auth emulator, for what a fake cannot prove: which token comes back, and
 * that Firebase keeps no session afterwards. Start it with `firebase emulators:start --only auth --project demo-jobflow`
 * from `android/`, then run `./gradlew connectedDevDebugAndroidTest`.
 */
@RunWith(AndroidJUnit4::class)
class FirebaseIdentityProviderTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val auth: FirebaseAuth = FirebaseAuth.getInstance()
    private val provider = FirebaseIdentityProvider(auth, context)

    @Before
    fun setUp() {
        if (!emulatorConnected) {
            auth.useEmulator(EMULATOR_HOST, EMULATOR_PORT)
            emulatorConnected = true
        }
        auth.signOut()
        admin("DELETE", "/emulator/v1/projects/$EMULATOR_PROJECT/accounts")
    }

    @Test
    fun google_gives_a_firebase_token_and_leaves_no_session() = runBlocking {
        val result = within { provider.signInWithGoogle(googleToken("new")) }

        val token = (result as Either.Right).value
        assertEquals("google.com", claims(token).getJSONObject("firebase").getString("sign_in_provider"))
        assertNull(auth.currentUser)
    }

    @Test
    fun a_google_account_already_used_gives_that_account_s_token() = runBlocking {
        val existingUid = existingGoogleUser("existing")

        val token = (within { provider.signInWithGoogle(googleToken("existing")) } as Either.Right).value

        assertEquals(existingUid, claims(token).getString("user_id"))
        assertNull(auth.currentUser)
    }

    @Test
    fun a_disabled_google_account_fails_and_leaves_no_session() = runBlocking {
        disable(existingGoogleUser("disabled"))

        val result = within { provider.signInWithGoogle(googleToken("disabled")) }

        assertEquals(Either.Left(AuthError.AccountDisabled), result)
        assertNull(auth.currentUser)
    }

    @Test
    fun signing_out_leaves_no_session() = runBlocking {
        existingGoogleUser("leaving")
        auth.signInWithCredential(GoogleAuthProvider.getCredential(googleToken("leaving").value, null)).await()

        provider.signOut()

        assertTrue(auth.currentUser == null)
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

    private fun claims(token: IdToken): JSONObject {
        val payload = token.value.split(".")[1]
        return JSONObject(String(Base64.decode(payload, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)))
    }

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

    private companion object {
        // The SDK refuses a second useEmulator call on the same instance once it has been used.
        var emulatorConnected = false
    }
}
