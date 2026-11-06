package me.dthuy.jobflow.domain.auth

/** How a user can sign in. A new method does not compile until the service handles it. */
sealed interface SignInMethod {
    data object Guest : SignInMethod

    data class Google(val idToken: IdToken) : SignInMethod
}
