package me.dthuy.jobflow.core.common

import me.dthuy.jobflow.BuildConfig
import timber.log.Timber

/**
 * Fallback for exceptions a source mapper does not know. They usually mean a bug, so debug builds rethrow to make
 * it visible; release builds log and degrade to [AppError.Unknown].
 */
fun unexpected(t: Throwable, rethrow: Boolean = BuildConfig.DEBUG): AppError {
    if (rethrow) throw t
    Timber.e(t, "Unexpected error mapped to AppError.Unknown")
    return AppError.Unknown
}
