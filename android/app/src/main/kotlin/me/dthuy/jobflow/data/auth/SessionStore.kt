package me.dthuy.jobflow.data.auth

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import java.time.Clock
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.first
import me.dthuy.jobflow.domain.auth.UserId

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
    }
}
