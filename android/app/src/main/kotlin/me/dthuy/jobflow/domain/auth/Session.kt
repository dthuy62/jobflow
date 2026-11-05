package me.dthuy.jobflow.domain.auth

/** Who is using the app, known offline. */
sealed interface Session {
    val isSignedIn: Boolean get() = false

    /** The identity service has not answered yet. */
    data object Unknown : Session

    /** A device install gets one guest, so after that only Google is left. */
    data class SignedOut(val canStartGuest: Boolean) : Session

    data class Guest(val uid: Uid) : Session {
        override val isSignedIn: Boolean get() = true
    }

    data class Member(val uid: Uid) : Session {
        override val isSignedIn: Boolean get() = true
    }
}
