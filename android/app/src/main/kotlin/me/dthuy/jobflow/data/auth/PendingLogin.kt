package me.dthuy.jobflow.data.auth

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import javax.inject.Inject
import javax.inject.Singleton
import me.dthuy.jobflow.domain.auth.Uid

/** Which sign-in was running, because what an interruption means depends on it. */
enum class PendingSignIn { GUEST, GOOGLE }

/** Saves the proof of who a guest was while the provider moves away from them. */
interface GuestTokenKeeper {
    /** Throws an IOException if it cannot be written, so the switch stops while the guest can still be reached. */
    suspend fun keepGuestToken(token: String)

    /**
     * Records which account the switch landed on. A token no account was recorded for is never sent.
     * Never throws: it runs after the provider moved, where a throw would skip the rollback.
     */
    suspend fun bindGuestToken(uid: Uid)
}

/** What a sign-in must not lose if the app dies or the backend fails halfway. */
interface PendingLogin : GuestTokenKeeper {
    /** The sign-in that began and did not finish, if any. */
    suspend fun running(): PendingSignIn?

    /** Returns once the mark is on disk, or false if it could not be written: then the sign-in must not start. */
    suspend fun begin(signIn: PendingSignIn): Boolean

    suspend fun finish()

    /**
     * The kept token, only for the account it was kept for. The next person on a shared device must not receive the
     * data of the guest before them.
     */
    suspend fun guestTokenFor(uid: Uid?): String?

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

    override suspend fun guestTokenFor(uid: Uid?): String? {
        val current = store.current()
        return current[GUEST_TOKEN].takeIf { uid != null && current[GUEST_TOKEN_TARGET] == uid.value }
    }

    override suspend fun keepGuestToken(token: String) {
        store.edit {
            it[GUEST_TOKEN] = token
            it.remove(GUEST_TOKEN_TARGET)
        }
    }

    override suspend fun bindGuestToken(uid: Uid) {
        store.tryEdit { it[GUEST_TOKEN_TARGET] = uid.value }
    }

    override suspend fun clearGuestToken() {
        store.tryEdit {
            it.remove(GUEST_TOKEN)
            it.remove(GUEST_TOKEN_TARGET)
        }
    }

    private companion object {
        val RUNNING = stringPreferencesKey("login_running")
        val GUEST_TOKEN = stringPreferencesKey("guest_token")
        val GUEST_TOKEN_TARGET = stringPreferencesKey("guest_token_target")
    }
}
