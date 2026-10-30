package me.dthuy.jobflow.core.common

/**
 * The error vocabulary every layer above `data/` sees. Each data source has one mapper that turns its exceptions
 * into these (for example `Throwable.toApiError()`); the UI maps them once with `AppError.toUiError()`.
 * No [Throwable] is kept here: causes are logged at the mapping boundary, which keeps `equals` stable and
 * exception messages out of UI state.
 */
sealed interface AppError {
    /** No connection to the wrapper: IO failure, timeout, DNS. */
    data object Unreachable : AppError

    /** The wrapper requires a valid pairing token. */
    data object Unauthorized : AppError

    /** The wrapper answered with one of its stable error codes (any 4xx, or a 5xx that carries a known code). */
    data class Rejected(val code: ApiErrorCode) : AppError

    /** The wrapper failed (5xx) without a known error code. */
    data class ServerFailure(val status: Int) : AppError

    /** The response did not match the contract. */
    data object InvalidResponse : AppError

    /** Something unexpected, already logged. Debug builds rethrow instead (see [unexpected]). */
    data object Unknown : AppError

    /** A failure only one feature gives meaning to; the feature's screen maps its own [FeatureError] subtypes. */
    data class Feature(val reason: FeatureError) : AppError
}

/** Each feature declares a sealed hierarchy implementing this in `domain/model/`. */
interface FeatureError
