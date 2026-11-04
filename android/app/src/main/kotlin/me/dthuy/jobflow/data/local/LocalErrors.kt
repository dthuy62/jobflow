package me.dthuy.jobflow.data.local

import android.database.SQLException
import kotlinx.coroutines.CancellationException
import me.dthuy.jobflow.core.common.AppError
import me.dthuy.jobflow.core.common.unexpected
import timber.log.Timber

/**
 * The local database's error mapper. On Android every SQLite failure, from either driver, is a [SQLException]:
 * `androidx.sqlite.SQLiteException` is an alias of it, and the framework's disk-full and corrupt errors extend it.
 */
fun Throwable.toLocalError(): AppError = when (this) {
    is CancellationException -> throw this
    is SQLException -> {
        Timber.w(this, "Local database failed")
        AppError.StorageFailure
    }
    else -> unexpected(this)
}
