package me.dthuy.jobflow.domain.auth

/**
 * A device install gets one guest. This is a product rule, not abuse protection: reinstalling resets it, and scripts
 * never run this code. Someone already signed in is not refused, because starting a guest does nothing for them.
 */
object GuestPolicy {
    fun canStart(alreadyUsed: Boolean, signedIn: Boolean): Boolean = signedIn || !alreadyUsed
}
