package me.dthuy.jobflow.domain.auth

/** The backend's id for a user. Kept on the device with the session, so it is known offline. */
@JvmInline
value class UserId(val value: String)

/** Proof of who signed in: from Google for the identity service, or from the identity service for the backend. */
@JvmInline
value class IdToken(val value: String) {
    // So a token cannot reach a log by accident.
    override fun toString(): String = "IdToken(***)"
}
