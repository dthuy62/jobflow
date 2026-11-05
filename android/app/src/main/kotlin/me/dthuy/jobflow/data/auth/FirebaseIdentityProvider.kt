package me.dthuy.jobflow.data.auth

import android.content.Context
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.Tasks
import com.google.firebase.auth.AuthCredential
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.FirebaseAuthUserCollisionException
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.IOException
import java.util.concurrent.ExecutionException
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.tasks.await
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.catch
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Uid
import timber.log.Timber

private const val TIMEOUT_SECONDS = 15L

/** The only class that calls Firebase Auth. It never creates a user unless asked: fetching a token only reads. */
@Singleton
class FirebaseIdentityProvider @Inject constructor(
    private val auth: FirebaseAuth,
    @param:ApplicationContext private val context: Context,
) : IdentityProvider,
    IdTokenSource {
    // The token listener, because linking keeps the uid: only a token change is documented to report it.
    override val user: Flow<IdentityUser?> = callbackFlow {
        val listener = FirebaseAuth.IdTokenListener { trySend(it.currentUser?.toIdentityUser()) }
        auth.addIdTokenListener(listener)
        awaitClose { auth.removeIdTokenListener(listener) }
    }.distinctUntilChanged()

    override suspend fun signInAsGuest(): Either<AuthError, Unit> =
        Either.catch(onError = AuthErrorMapper::fromFirebase) {
            if (auth.currentUser == null) auth.signInAnonymously().await()
        }

    override suspend fun signInWithGoogle(idToken: IdToken): Either<AuthError, Unit> =
        Either.catch(onError = AuthErrorMapper::fromFirebase) {
            val credential = GoogleAuthProvider.getCredential(idToken.value, null)
            val guest = auth.currentUser?.takeIf { it.isAnonymous }
            if (guest != null) linkOrSwitch(guest, credential) else auth.signInWithCredential(credential).await()
            refreshToken()
        }

    // The API reads anonymous or not from the token, so it wants one issued after a sign-in. Best effort: the sign-in
    // has already happened, so a failure here must not report it as failed. The SDK refreshes the token later.
    private suspend fun refreshToken() {
        Either.catch(onError = { Timber.w(it, "Could not refresh the token after signing in") }) {
            auth.currentUser?.getIdToken(true)?.await()
        }
    }

    private suspend fun linkOrSwitch(guest: FirebaseUser, credential: AuthCredential) {
        try {
            guest.linkWithCredential(credential).await()
        } catch (error: FirebaseAuthUserCollisionException) {
            auth.signInWithCredential(error.updatedCredential ?: credential).await()
        } catch (error: FirebaseAuthInvalidUserException) {
            // Here it is the guest that is gone. The same error from signing in would only be about the Google account.
            auth.signOut()
            throw error
        }
    }

    override suspend fun signOut() {
        auth.signOut()
        // Best effort: if this fails, Google may only offer the same account again without asking.
        Either.catch(onError = { Timber.w(it, "Could not clear the Google credential state") }) {
            CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest())
        }
    }

    override fun idToken(forceRefresh: Boolean): String? = try {
        auth.currentUser?.getIdToken(forceRefresh)?.awaitBlocking()?.token
    } catch (error: ExecutionException) {
        // Only an account Firebase no longer accepts ends the session. Anything else is temporary, and for a guest
        // losing the session would lose their identity for good.
        if (error.cause !is FirebaseAuthInvalidUserException) throw IOException(error)
        auth.signOut()
        null
    } catch (error: TimeoutException) {
        throw IOException(error)
    } catch (error: InterruptedException) {
        Thread.currentThread().interrupt()
        throw IOException(error)
    }

    private fun <T> Task<T>.awaitBlocking(): T = Tasks.await(this, TIMEOUT_SECONDS, TimeUnit.SECONDS)
}

private fun FirebaseUser.toIdentityUser() = IdentityUser(uid = Uid(uid), isAnonymous = isAnonymous)
