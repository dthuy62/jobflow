package me.dthuy.jobflow.testing

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.data.auth.IdentityProvider
import me.dthuy.jobflow.data.auth.IdentityUser
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.IdToken

/** Stays silent until [publish], like the real service before its first answer. */
class FakeIdentityProvider(var result: Either<AuthError, Unit> = Either.Right(Unit)) : IdentityProvider {
    private val users = MutableSharedFlow<IdentityUser?>(replay = 1)
    override val user: Flow<IdentityUser?> = users

    var guestSignIns = 0
    var signOuts = 0
    val tokens = mutableListOf<IdToken>()
    var gate: CompletableDeferred<Unit>? = null

    suspend fun publish(user: IdentityUser?) = users.emit(user)

    override suspend fun signInAsGuest(): Either<AuthError, Unit> {
        guestSignIns++
        return result
    }

    override suspend fun signInWithGoogle(idToken: IdToken): Either<AuthError, Unit> {
        tokens += idToken
        gate?.await()
        return result
    }

    override suspend fun signOut() {
        signOuts++
    }
}
