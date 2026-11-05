package me.dthuy.jobflow.data.auth

import android.content.Context
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/** What a sign-in must not lose if the app dies or the backend fails halfway. */
interface PendingLogin {
    fun isRunning(): Boolean

    fun begin()

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

    override fun isRunning(): Boolean = preferences.getBoolean(KEY_RUNNING, false)

    // Written to disk before the provider is touched: the mark is useless if the app can die before it lands.
    override fun begin() = preferences.edit(commit = true) { putBoolean(KEY_RUNNING, true) }

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
