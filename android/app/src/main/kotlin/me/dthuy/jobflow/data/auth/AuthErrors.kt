package me.dthuy.jobflow.data.auth

import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.core.common.DataSourceError
import me.dthuy.jobflow.domain.auth.AuthError

/**
 * What a failed auth API call means for signing in. Only what changes what the user can do stays apart: no connection,
 * too many attempts, or a sign-in to try again. Exhaustive on purpose, so a new source error is a decision here.
 */
fun DataSourceError.toAuthError(): AuthError = when (this) {
    DataSourceError.Remote.Unreachable -> AuthError.Network
    is DataSourceError.Remote.Rejected ->
        if (code == ApiErrorCode.RATE_LIMITED) AuthError.TooManyAttempts else AuthError.SignInFailed
    DataSourceError.Remote.Unauthorized,
    is DataSourceError.Remote.ServerFailure,
    DataSourceError.Remote.InvalidResponse,
    DataSourceError.Local.StorageFailure,
    DataSourceError.Unknown,
    -> AuthError.SignInFailed
}
