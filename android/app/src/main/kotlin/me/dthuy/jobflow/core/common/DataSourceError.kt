package me.dthuy.jobflow.core.common

/**
 * How a data source shared by several features failed. It says nothing about what that means for a feature: a feature
 * with its own failures translates it into its own error, and the UI translates either into what the user sees.
 * A source only one feature uses maps straight to that feature's error. Add a group here when a new source is shared.
 * No [Throwable] is kept: causes are logged where they are mapped, so `equals` stays stable and exception text never
 * reaches UI state.
 */
sealed interface DataSourceError {
    /** The hosted API. */
    sealed interface Remote : DataSourceError {
        /** No connection: IO failure, timeout, DNS. */
        data object Unreachable : Remote

        /** The API rejected the session (401). */
        data object Unauthorized : Remote

        /** The API answered with one of its stable error codes (any 4xx, or a 5xx that carries a known code). */
        data class Rejected(val code: ApiErrorCode) : Remote

        /** The API failed (5xx) without a known error code. */
        data class ServerFailure(val status: Int) : Remote

        /** The response did not match the contract. */
        data object InvalidResponse : Remote
    }

    /** The local database. Its data is a cache, so the API can rebuild it. */
    sealed interface Local : DataSourceError {
        data object StorageFailure : Local
    }

    /** Something unexpected, already logged. Debug builds rethrow instead (see [unexpected]). */
    data object Unknown : DataSourceError
}
