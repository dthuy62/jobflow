package me.dthuy.jobflow.domain.auth

/**
 * Lets the app react to a session change without the auth code knowing what it stores. Register one with `@IntoSet`. It
 * runs before anyone sees the new session; a failure is logged and blocks neither the session nor other observers.
 */
fun interface SessionObserver {
    /** [uid] is the user now signed in, or null if nobody is. */
    suspend fun onSessionChanged(uid: Uid?)
}
