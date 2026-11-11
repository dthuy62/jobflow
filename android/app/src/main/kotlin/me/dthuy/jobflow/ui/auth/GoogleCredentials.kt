package me.dthuy.jobflow.ui.auth

import android.content.Context
import androidx.credentials.Credential
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnknownException
import androidx.credentials.exceptions.GetCredentialUnsupportedException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import kotlinx.coroutines.CancellationException
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.core.common.catch
import me.dthuy.jobflow.core.common.fold
import me.dthuy.jobflow.core.common.unexpected
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken
import timber.log.Timber

/**
 * Shows Google's sign-in sheet, which needs an Activity [context], so this one data source lives in the UI layer.
 * A null token means the user closed the sheet, which is not a failure.
 */
suspend fun requestGoogleIdToken(context: Context, webClientId: String): Either<AuthError, IdToken?> =
    Either.catch(onError = { it }) {
        val option = GetSignInWithGoogleOption.Builder(webClientId).build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
        CredentialManager.create(context).getCredential(context, request).credential.googleIdToken()
    }.fold(onLeft = Throwable::toGoogleSignInResult, onRight = { Either.Right(it) })

private fun Credential.googleIdToken(): IdToken =
    if (this is CustomCredential && type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
        IdToken(GoogleIdTokenCredential.createFrom(data).idToken)
    } else {
        throw GetCredentialUnknownException("Google's sheet returned another type of credential")
    }

/**
 * Credential Manager's error mapper: the only code that knows its exception types. Closing the sheet is not an error,
 * so it answers with no token.
 */
fun Throwable.toGoogleSignInResult(): Either<AuthError, IdToken?> = when (this) {
    is CancellationException -> throw this
    is GetCredentialCancellationException -> Either.Right(null)
    is NoCredentialException -> Either.Left(AuthError.NoGoogleAccount)
    is GetCredentialProviderConfigurationException, is GetCredentialUnsupportedException -> {
        Timber.w(this, "Google sign-in is unavailable")
        Either.Left(AuthError.GoogleUnavailable)
    }
    is GetCredentialException, is GoogleIdTokenParsingException -> {
        Timber.w(this, "Google sign-in failed")
        Either.Left(AuthError.SignInFailed)
    }
    else -> {
        unexpected(this)
        Either.Left(AuthError.SignInFailed)
    }
}
