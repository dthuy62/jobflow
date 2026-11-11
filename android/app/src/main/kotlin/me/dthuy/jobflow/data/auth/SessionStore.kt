package me.dthuy.jobflow.data.auth

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import java.io.IOException
import java.time.Clock
import javax.inject.Inject
import javax.inject.Qualifier
import javax.inject.Singleton
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import me.dthuy.jobflow.domain.auth.UserId
import timber.log.Timber

private const val MILLIS_PER_SECOND = 1_000L

/** The backend's session as the device keeps it. [expiresAt] is when the access token ends, in epoch milliseconds. */
data class StoredSession(
    val userId: UserId,
    val isGuest: Boolean,
    val accessToken: String,
    val refreshToken: String,
    val expiresAt: Long,
) {
    // So a token cannot reach a log by accident.
    override fun toString(): String = "StoredSession(userId=$userId, isGuest=$isGuest)"
}

/** Counts the token's life from when the answer arrived, so a wrong device clock does not matter. */
fun SessionTokensDto.expiresAt(clock: Clock): Long = clock.millis() + expiresIn * MILLIS_PER_SECOND

fun SessionTokensDto.toStoredSession(account: MeDto, clock: Clock) = StoredSession(
    userId = UserId(account.userId),
    isGuest = account.isAnonymous,
    accessToken = accessToken,
    refreshToken = refreshToken,
    expiresAt = expiresAt(clock),
)

/** The only copy of the session on the device. */
interface SessionStore {
    /** Null if there is none, or it cannot be read. */
    suspend fun read(): StoredSession?

    /** Throws an IOException if it cannot be read, so a sign-in never writes over a session it could not see. */
    suspend fun readOrThrow(): StoredSession?

    /** Throws an IOException if it cannot be written, so a sign-in never reports success with nothing kept. */
    suspend fun save(session: StoredSession)

    /** Only while [refreshToken] is still the stored one, so an answer for an ended session changes nothing. */
    suspend fun updateAccessToken(refreshToken: String, accessToken: String, expiresAt: Long)

    /** With [onlyIf], only while that refresh token is still the stored one. */
    suspend fun clear(onlyIf: String? = null)

    /** Whether this install of the app has had its guest. Uninstalling is what resets it; signing out does not. */
    suspend fun isGuestUsed(): Boolean

    suspend fun markGuestUsed()
}

@Singleton
class DataStoreSessionStore @Inject constructor(@AuthStore private val store: DataStore<Preferences>) : SessionStore {
    override suspend fun read(): StoredSession? = store.current().toSession()

    override suspend fun readOrThrow(): StoredSession? = store.data.first().toSession()

    private fun Preferences.toSession(): StoredSession? {
        val current = this
        // All parts are written in one edit, so a part missing means there is no session.
        if (listOf(USER_ID, IS_GUEST, ACCESS_TOKEN, REFRESH_TOKEN, EXPIRES_AT).any { it !in current }) return null
        return StoredSession(
            userId = UserId(checkNotNull(current[USER_ID])),
            isGuest = checkNotNull(current[IS_GUEST]),
            accessToken = checkNotNull(current[ACCESS_TOKEN]),
            refreshToken = checkNotNull(current[REFRESH_TOKEN]),
            expiresAt = checkNotNull(current[EXPIRES_AT]),
        )
    }

    override suspend fun save(session: StoredSession) {
        store.edit {
            it[USER_ID] = session.userId.value
            it[IS_GUEST] = session.isGuest
            it[ACCESS_TOKEN] = session.accessToken
            it[REFRESH_TOKEN] = session.refreshToken
            it[EXPIRES_AT] = session.expiresAt
        }
    }

    override suspend fun updateAccessToken(refreshToken: String, accessToken: String, expiresAt: Long) {
        store.tryEdit {
            if (it[REFRESH_TOKEN] == refreshToken) {
                it[ACCESS_TOKEN] = accessToken
                it[EXPIRES_AT] = expiresAt
            }
        }
    }

    override suspend fun clear(onlyIf: String?) {
        store.tryEdit { if (onlyIf == null || it[REFRESH_TOKEN] == onlyIf) it.removeSession() }
    }

    override suspend fun isGuestUsed(): Boolean = store.current()[GUEST_USED] == true

    override suspend fun markGuestUsed() {
        store.tryEdit { it[GUEST_USED] = true }
    }

    private fun MutablePreferences.removeSession() {
        remove(USER_ID)
        remove(IS_GUEST)
        remove(ACCESS_TOKEN)
        remove(REFRESH_TOKEN)
        remove(EXPIRES_AT)
    }

    private companion object {
        val USER_ID = stringPreferencesKey("user_id")
        val IS_GUEST = booleanPreferencesKey("is_guest")
        val ACCESS_TOKEN = stringPreferencesKey("access_token")
        val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        val EXPIRES_AT = longPreferencesKey("expires_at")

        // Kept apart from the session's keys, so clearing a session leaves it.
        val GUEST_USED = booleanPreferencesKey("guest_used")
    }
}

/** The file holding auth's own state. Left out of backup and device transfer (`data_extraction_rules.xml`). */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class AuthStore

/** A failed read answers as if nothing was stored: when unsure, never risk losing someone's identity. */
internal suspend fun DataStore<Preferences>.current(): Preferences = data
    .catch { error ->
        if (error !is IOException) throw error
        Timber.w(error, "Could not read auth state")
        emit(emptyPreferences())
    }
    .first()

/** Returns once the change is on disk, or false if it could not be written. */
internal suspend fun DataStore<Preferences>.tryEdit(change: (MutablePreferences) -> Unit): Boolean = try {
    edit(change)
    true
} catch (error: IOException) {
    Timber.w(error, "Could not write auth state")
    false
}
