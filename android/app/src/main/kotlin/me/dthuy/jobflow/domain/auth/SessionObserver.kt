package me.dthuy.jobflow.domain.auth

/**
 * Lets the app react to a change of user without the auth code knowing what it stores. Register one with `@IntoSet`. It
 * runs before anyone sees the new session; a failure is logged and blocks neither the session nor other observers.
 */
fun interface SessionObserver {
    /** Runs when the user changes, also when a guest signs in with Google and their data moves. Null means nobody. */
    suspend fun onUserChanged(userId: UserId?)
}
