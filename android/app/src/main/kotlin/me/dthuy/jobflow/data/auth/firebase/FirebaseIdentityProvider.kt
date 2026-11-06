package me.dthuy.jobflow.data.auth.firebase

import android.content.Context
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.tasks.await
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.catch
import me.dthuy.jobflow.data.auth.IdentityProvider
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import timber.log.Timber

/** The only class that calls Firebase Auth. Firebase only proves who signed in; it keeps no session on the device. */
@Singleton
class FirebaseIdentityProvider @Inject constructor(
    private val auth: FirebaseAuth,
    @ApplicationContext private val context: Context,
) : IdentityProvider {
    override suspend fun signInWithGoogle(idToken: IdToken): Either<AuthError, IdToken> =
        Either.catch(onError = FirebaseAuthErrorMapper::map) {
            try {
                val credential = GoogleAuthProvider.getCredential(idToken.value, null)
                val user = checkNotNull(auth.signInWithCredential(credential).await().user) { "No user after sign-in" }
                IdToken(checkNotNull(user.getIdToken(false).await().token) { "No ID token after sign-in" })
            } finally {
                auth.signOut()
            }
        }

    override suspend fun signOut() {
        auth.signOut()
        // Best effort: if this fails, Google may only offer the same account again without asking.
        Either.catch(onError = { Timber.w(it, "Could not clear the Google credential state") }) {
            CredentialManager.create(context).clearCredentialState(ClearCredentialStateRequest())
        }
    }
}
