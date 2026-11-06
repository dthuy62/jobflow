package me.dthuy.jobflow.data.auth

import me.dthuy.jobflow.core.common.ApiErrorCode
import me.dthuy.jobflow.core.common.DataSourceError
import me.dthuy.jobflow.domain.auth.AuthError
import org.junit.Assert.assertEquals
import org.junit.Test

class AuthErrorsTest {
    @Test
    fun `no connection says so`() {
        assertEquals(AuthError.Network, DataSourceError.Remote.Unreachable.toAuthError())
    }

    @Test
    fun `too many requests says so`() {
        assertEquals(
            AuthError.TooManyAttempts,
            DataSourceError.Remote.Rejected(ApiErrorCode.RATE_LIMITED).toAuthError(),
        )
    }

    @Test
    fun `anything else is a sign-in to try again`() {
        listOf(
            DataSourceError.Remote.Rejected(ApiErrorCode.AUTH_UNAVAILABLE),
            DataSourceError.Remote.Unauthorized,
            DataSourceError.Remote.ServerFailure(500),
            DataSourceError.Remote.InvalidResponse,
            DataSourceError.Local.StorageFailure,
            DataSourceError.Unknown,
        ).forEach { assertEquals(it.toString(), AuthError.SignInFailed, it.toAuthError()) }
    }
}
