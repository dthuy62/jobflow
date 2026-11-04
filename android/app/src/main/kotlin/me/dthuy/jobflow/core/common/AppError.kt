package me.dthuy.jobflow.core.common

/**
 * The error vocabulary every layer above `data/` sees. Each data source has one mapper that turns its exceptions
 * into these (for example `Throwable.toApiError()`); the UI maps them once with `AppError.toUiError()`.
 * No [Throwable] is kept here: causes are logged at the mapping boundary, which keeps `equals` stable and
 * exception messages out of UI state.
 */
sealed interface AppError {
    /** No connection to the API: IO failure, timeout, DNS. */
    data object Unreachable : AppError

    /** The API rejected the session (401): the user has to sign in again. */
    data object Unauthorized : AppError

    /** The API answered with one of its stable error codes (any 4xx, or a 5xx that carries a known code). */
    data class Rejected(val code: ApiErrorCode) : AppError

    /** The API failed (5xx) without a known error code. */
    data class ServerFailure(val status: Int) : AppError

    /** The response did not match the contract. */
    data object InvalidResponse : AppError

    /** The local database failed. Its data is a cache, so the API can rebuild it. */
    data object StorageFailure : AppError

    /** Something unexpected, already logged. Debug builds rethrow instead (see [unexpected]). */
    data object Unknown : AppError

    /** A failure only one feature gives meaning to; the feature's screen maps its own [FeatureError] subtypes. */
    data class Feature(val reason: FeatureError) : AppError
}

/** Each feature declares a sealed hierarchy implementing this in `domain/model/`. */
interface FeatureError
