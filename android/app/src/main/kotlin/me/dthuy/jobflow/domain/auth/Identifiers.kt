package me.dthuy.jobflow.domain.auth

/** The identity service's id for a user, known offline. Not the API's user id. */
@JvmInline
value class Uid(val value: String)

/** Proof from Google that someone signed in. */
@JvmInline
value class IdToken(val value: String) {
    // So a token cannot reach a log by accident.
    override fun toString(): String = "IdToken(***)"
}
