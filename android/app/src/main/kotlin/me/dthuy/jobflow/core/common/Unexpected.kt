package me.dthuy.jobflow.core.common

import me.dthuy.jobflow.BuildConfig
import timber.log.Timber

/**
 * Fallback for exceptions a source mapper does not know. They usually mean a bug, so debug builds rethrow to make
 * it visible; release builds log and degrade to [DataSourceError.Unknown].
 */
fun unexpected(t: Throwable, rethrow: Boolean = BuildConfig.DEBUG): DataSourceError {
    if (rethrow) throw t
    Timber.e(t, "Unexpected error mapped to DataSourceError.Unknown")
    return DataSourceError.Unknown
}
