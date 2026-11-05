package me.dthuy.jobflow.testing

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

/** Answers with [signIn] and [guest]. */
class FakeAuthRepository(
    session: Session = GUEST_SESSION,
    var signIn: Either<AuthError, Unit> = Either.Right(Unit),
    var guest: Either<AuthError, Unit> = Either.Right(Unit),
) : AuthRepository {
    private val _session = MutableStateFlow(session)
    override val session: StateFlow<Session> = _session

    val tokens = mutableListOf<IdToken>()
    var signOuts = 0

    fun publish(session: Session) {
        _session.value = session
    }

    override suspend fun continueAsGuest(): Either<AuthError, Unit> {
        if (guest is Either.Right) publish(GUEST_SESSION)
        return guest
    }

    override suspend fun signInWithGoogle(idToken: IdToken): Either<AuthError, Unit> {
        tokens += idToken
        if (signIn is Either.Right) publish(MEMBER_SESSION)
        return signIn
    }

    override suspend fun signOut() {
        signOuts++
        publish(Session.SignedOut(canStartGuest = false))
    }
}
