# 10. Use Either and map errors at two boundaries

Status: Accepted (2026-10-30)

## Context

ADR 3 made expected failures values (`Outcome`/`AppError`). JobFlow adds a backend with its own stable error codes, will
add more sources (Room cache, artifact downloads, App Check), and needs the UI to show specific messages without
knowing SDK exception types. A review against Android's data and UI layer guidance and the Kotlin `Result` design notes
(2026-10-30) also flagged three risks: catching every `Exception` hides bugs, a `Throwable` inside error values breaks
`equals` and can leak text into the UI, and a single flat error type grows without bound.

## Decision

- Repositories return `Either<AppError, T>` (Left is the error); `Either.catch(onError) { }` replaces `outcomeOf`. The
  name follows the team's habit; the shape is the same.
- Errors change shape at two boundaries only:
  1. one mapper per data source in `data/` (`Throwable.toApiError()`), which maps only known exception types and sends
     anything else to `unexpected()` (rethrow in debug, log and `AppError.Unknown` in release);
  2. one app-wide `AppError.toUiError()` in `ui/components`, exhaustive with no `else`.
- `AppError` has a small set of shared cases plus `Feature(reason: FeatureError)`. Each feature defines a sealed
  `FeatureError` hierarchy and maps it in its own screen; the global mapper only falls back for it.
- A wrapper error code that is a normal branch of a flow becomes part of the success type instead of an error.
- `AppError` holds no `Throwable`. Wrapper error codes are mirrored in `ApiErrorCode` (with `UNKNOWN`) and kept in sync
  by tests on both sides of `career-ops-wrapper/contracts/error-codes.json`.
- Konsist fails the build when code outside `core/common` and data sources catches exceptions.

Rejected: the name `Outcome` (team preference); an `apiCall {}` or `ApiCaller` wrapper (no collaborators yet, so a
mapper function plus `Either.catch` is enough; it becomes an injected class when it needs a logger or token refresh); a
Retrofit `CallAdapter`; per-operation `Either<E, T>` everywhere (precise but heavy for one developer); and
`FeatureError.toUiError()` in `domain/` (it would make `domain/` depend on string resources).

## Consequences

Adding a shared error case fails compilation until the UI handles it. Adding a data source means writing one mapper.
Feature errors are checked exhaustively in their own screen but only by a logged fallback globally. Swapping an SDK
touches its mapper, not the UI. JobFlow's naming differs from the starter's.
