package me.dthuy.jobflow.data.auth

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.stringPreferencesKey
import javax.inject.Inject
import javax.inject.Singleton

/** Which sign-in was running, because what an interruption means depends on it. */
enum class PendingSignIn { GUEST, GOOGLE }

/** What a sign-in must not lose if the app dies or the backend fails halfway. */
interface PendingLogin {
    /** The sign-in that began and did not finish, if any. */
    suspend fun running(): PendingSignIn?

    /** Returns once the mark is on disk, or false if it could not be written: then the sign-in must not start. */
    suspend fun begin(signIn: PendingSignIn): Boolean

    suspend fun finish()

    /** Proof of who the guest was, kept once the provider has switched away from them, until the backend has merged. */
    suspend fun guestToken(): String?

    suspend fun keepGuestToken(token: String)

    suspend fun clearGuestToken()
}

@Singleton
class DataStorePendingLogin @Inject constructor(@AuthStore private val store: DataStore<Preferences>) : PendingLogin {
    override suspend fun running(): PendingSignIn? =
        store.current()[RUNNING]?.let { name -> PendingSignIn.entries.find { it.name == name } }

    override suspend fun begin(signIn: PendingSignIn): Boolean = store.tryEdit { it[RUNNING] = signIn.name }

    override suspend fun finish() {
        store.tryEdit { it.remove(RUNNING) }
    }

    override suspend fun guestToken(): String? = store.current()[GUEST_TOKEN]

    override suspend fun keepGuestToken(token: String) {
        store.tryEdit { it[GUEST_TOKEN] = token }
    }

    override suspend fun clearGuestToken() {
        store.tryEdit { it.remove(GUEST_TOKEN) }
    }

    private companion object {
        val RUNNING = stringPreferencesKey("login_running")
        val GUEST_TOKEN = stringPreferencesKey("guest_token")
    }
}
