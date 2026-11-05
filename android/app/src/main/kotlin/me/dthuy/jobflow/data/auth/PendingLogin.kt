package me.dthuy.jobflow.data.auth

import android.content.Context
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/** Which sign-in was running, because what an interruption means depends on it. */
enum class PendingSignIn { GUEST, GOOGLE }

/** What a sign-in must not lose if the app dies or the backend fails halfway. */
interface PendingLogin {
    /** The sign-in that began and did not finish, if any. */
    fun running(): PendingSignIn?

    fun begin(signIn: PendingSignIn)

    fun finish()

    /** Proof of who the guest was, kept once the provider has switched away from them, until the backend has merged. */
    fun guestToken(): String?

    fun keepGuestToken(token: String)

    fun clearGuestToken()
}

/** Left out of backup and device transfer (`data_extraction_rules.xml`). */
@Singleton
class PreferencesPendingLogin @Inject constructor(@ApplicationContext context: Context) : PendingLogin {
    private val preferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    override fun running(): PendingSignIn? =
        preferences.getString(KEY_RUNNING, null)?.let { name -> PendingSignIn.entries.find { it.name == name } }

    // Written to disk before the provider is touched: the mark is useless if the app can die before it lands.
    override fun begin(signIn: PendingSignIn) = preferences.edit(commit = true) { putString(KEY_RUNNING, signIn.name) }

    override fun finish() = preferences.edit(commit = true) { remove(KEY_RUNNING) }

    override fun guestToken(): String? = preferences.getString(KEY_GUEST_TOKEN, null)

    override fun keepGuestToken(token: String) = preferences.edit(commit = true) { putString(KEY_GUEST_TOKEN, token) }

    override fun clearGuestToken() = preferences.edit { remove(KEY_GUEST_TOKEN) }

    private companion object {
        const val FILE = "auth_pending_login"
        const val KEY_RUNNING = "running"
        const val KEY_GUEST_TOKEN = "guest_token"
    }
}
