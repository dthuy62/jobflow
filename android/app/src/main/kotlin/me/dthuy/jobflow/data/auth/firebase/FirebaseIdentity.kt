package me.dthuy.jobflow.data.auth.firebase

import android.content.Context
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import com.google.firebase.FirebaseException
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.FirebaseTooManyRequestsException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthInvalidUserException
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.installations.FirebaseInstallations
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.catch
import me.dthuy.jobflow.core.common.getOrNull
import me.dthuy.jobflow.core.common.unexpected
import me.dthuy.jobflow.data.auth.IdentityProvider
import me.dthuy.jobflow.data.auth.InstallationIdSource
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import timber.log.Timber

private const val ERROR_USER_DISABLED = "ERROR_USER_DISABLED"

/** The only class that calls Firebase Auth. Firebase only proves who signed in; it keeps no session on the device. */
@Singleton
class FirebaseIdentityProvider @Inject constructor(
    private val auth: FirebaseAuth,
    @ApplicationContext private val context: Context,
) : IdentityProvider {
    override suspend fun signInWithGoogle(idToken: IdToken): Either<AuthError, IdToken> =
        Either.catch(onError = Throwable::toAuthError) {
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

/** The Firebase Installation ID, which FCM is moving to. It changes on reinstall or when app data is cleared. */
class FirebaseInstallationIdSource @Inject constructor() : InstallationIdSource {
    override suspend fun id(): String? = Either.catch(onError = {
        Timber.w(it, "Could not read the installation id")
    }) {
        FirebaseInstallations.getInstance().id.await()
    }.getOrNull()
}

/** Firebase Auth's error mapper: the only code that knows its exception types. Only auth uses Firebase Auth. */
fun Throwable.toAuthError(): AuthError = when (this) {
    is CancellationException -> throw this
    is FirebaseNetworkException -> AuthError.Network
    is FirebaseTooManyRequestsException -> AuthError.TooManyAttempts
    is FirebaseAuthInvalidUserException ->
        if (errorCode == ERROR_USER_DISABLED) AuthError.AccountDisabled else AuthError.SignInFailed
    is FirebaseException -> {
        Timber.w(this, "Firebase sign-in failed")
        AuthError.SignInFailed
    }
    else -> {
        unexpected(this)
        AuthError.SignInFailed
    }
}
