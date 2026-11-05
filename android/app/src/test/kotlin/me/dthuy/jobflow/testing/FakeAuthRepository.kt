package me.dthuy.jobflow.testing

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import me.dthuy.jobflow.core.common.Either
import me.dthuy.jobflow.domain.auth.AuthError
import me.dthuy.jobflow.domain.auth.AuthRepository
import me.dthuy.jobflow.domain.auth.IdToken
import me.dthuy.jobflow.domain.auth.Session
import me.dthuy.jobflow.domain.auth.Uid

val GUEST_SESSION = Session.Guest(Uid("uid_guest"))
val MEMBER_SESSION = Session.Member(Uid("uid_google"))

/** Answers with [signIn]; set [gate] to hold a sign-in in flight. */
class FakeAuthRepository(session: Session = GUEST_SESSION, var signIn: Either<AuthError, Unit> = Either.Right(Unit)) :
    AuthRepository {
    private val _session = MutableStateFlow(session)
    override val session: StateFlow<Session> = _session

    val tokens = mutableListOf<IdToken>()
    var signOuts = 0
    var gate: CompletableDeferred<Unit>? = null

    fun publish(session: Session) {
        _session.value = session
    }

    override suspend fun continueAsGuest(): Either<AuthError, Unit> {
        publish(GUEST_SESSION)
        return Either.Right(Unit)
    }

    override suspend fun signInWithGoogle(idToken: IdToken): Either<AuthError, Unit> {
        tokens += idToken
        gate?.await()
        if (signIn is Either.Right) publish(MEMBER_SESSION)
        return signIn
    }

    override suspend fun signOut() {
        signOuts++
        publish(Session.SignedOut(canStartGuest = false))
    }
}
