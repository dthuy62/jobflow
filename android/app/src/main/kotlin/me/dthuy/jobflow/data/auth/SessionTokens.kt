package me.dthuy.jobflow.data.auth

import java.io.IOException
import java.net.HttpURLConnection.HTTP_UNAUTHORIZED
import java.time.Clock
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.SerializationException
import retrofit2.HttpException
import timber.log.Timber

// Covers the request's flight and some clock difference, so a token is not sent just as it ends.
private const val REFRESH_MARGIN_MS = 60_000L

/** Blocks, which OkHttp allows: it calls these off the main thread. Null means there is no session. */
interface AccessTokenSource {
    /** Refreshes first when the token is about to end. */
    @Throws(IOException::class)
    fun accessToken(): String?

    /** After the backend refused [rejected]. A token can end early, after a key rotation or a long sleep. */
    @Throws(IOException::class)
    fun refreshedAccessToken(rejected: String): String?
}

/**
 * Keeps the access token fresh. Only a 401 from the refresh call ends a session; a network failure or a 5xx keeps
 * it, so nobody is signed out for being offline.
 */
@Singleton
class SessionTokens @Inject constructor(
    private val store: SessionStore,
    // Lazy, because the API's own HTTP client needs this class.
    private val api: dagger.Lazy<AuthApi>,
    private val clock: Clock,
) : AccessTokenSource {
    private val lock = Any()

    // The last refresh, old token to new, so requests refused with the old one can retry with the new one.
    private var replaced: Pair<String, String>? = null
    private val _ended =
        MutableSharedFlow<Unit>(extraBufferCapacity = 1, onBufferOverflow = BufferOverflow.DROP_OLDEST)

    /** The backend ended the session. The store is already cleared. */
    val ended: Flow<Unit> = _ended

    override fun accessToken(): String? = read()?.let { session ->
        if (session.expiresAt - clock.millis() > REFRESH_MARGIN_MS) return session.accessToken
        try {
            refresh(session.accessToken)
        } catch (error: IOException) {
            // Not ended yet, so it may still work.
            if (session.expiresAt > clock.millis()) session.accessToken else throw error
        }
    }

    override fun refreshedAccessToken(rejected: String): String? = refresh(rejected)

    // One refresh at a time. One that waited finds the token already new and uses it. A token that is neither the
    // current one nor the one it replaced belongs to a session that has since ended or changed hands: retrying it with
    // the current token would send one user's request as another.
    private fun refresh(stale: String): String? = synchronized(lock) {
        val session = read() ?: return null
        if (session.accessToken != stale) {
            return replaced?.takeIf { it == stale to session.accessToken }?.second
        }
        val response = try {
            api.get().refresh(RefreshRequest(session.refreshToken)).execute()
        } catch (error: SerializationException) {
            throw IOException(error)
        }
        if (response.code() == HTTP_UNAUTHORIZED) {
            Timber.i("The backend ended the session")
            runBlocking { store.clear(onlyIf = session.refreshToken) }
            _ended.tryEmit(Unit)
            return null
        }
        val tokens = response.body()
        if (!response.isSuccessful || tokens == null) throw IOException(HttpException(response))
        runBlocking { store.updateAccessToken(session.refreshToken, tokens.accessToken, tokens.expiresAt(clock)) }
        replaced = stale to tokens.accessToken
        tokens.accessToken
    }

    private fun read(): StoredSession? = runBlocking { store.read() }
}
