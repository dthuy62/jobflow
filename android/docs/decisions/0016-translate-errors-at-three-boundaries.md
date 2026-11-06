# 16. Translate errors at three boundaries, from one shared data source error

Status: Accepted (2026-11-06)

Supersedes the error mapping parts of [ADR 10](0010-use-either-and-two-boundary-error-mapping.md) and
[ADR 14](0014-give-a-feature-its-own-error-type-when-it-has-its-own-failures.md). `Either`, no `Throwable` in errors, and
a feature's own error type when it has failures of its own all stay.

## Context

Each mapper did two jobs at once: knowing how an SDK fails, and deciding what that means for a feature. Auth had its
own `AuthApiErrorMapper` that knew Retrofit's exceptions a second time, only to return `AuthError` instead of
`AppError`. The two copies had already drifted: the shared one read the API's error code, auth's only the status.
Every feature with its own errors (CV, billing) would copy it again. `AppError` was also misnamed: every case says how
a source failed, none what it means for the app.

The owner's rule (2026-11-06): each layer may have its own errors, because each layer uses them for something else, and
by the UI some of them no longer matter.

## Decision

Errors change shape at three boundaries, and each layer keeps only what it decides something with.

1. **Source → `DataSourceError`: how a source failed.** `core/common/DataSourceError` has one group per data source
   shared by several features: `Remote` (the API) and `Local` (Room), plus `Unknown`. Each SDK has exactly one mapper,
   the only code that knows its exception types: `Throwable.toRemoteError()` in `core/network` for Retrofit and OkHttp,
   `Throwable.toLocalError()` in `data/local` for Room. Unknown exceptions go to `unexpected()`.
2. **`DataSourceError` → feature error: what it means for the feature.** Only a feature with failures of its own has
   one, for example `AuthError`. The translation is a pure exhaustive `when`, such as `DataSourceError.toAuthError()`,
   which knows no exception type. Each case of a feature error must change what the user sees or can do.
3. **Error → `UiError`: what the user sees and can do.** One exhaustive `toUiError()` per error type. Errors that show
   the same thing collapse into one case, and "show nothing" is a branch too, never an `else`.

**Where a new source goes.** A source only one feature uses, such as Firebase Auth or Credential Manager for auth, maps
straight to that feature's error in its own adapter (`Throwable.toAuthError()`, `Throwable.toGoogleSignInResult()`).
A source two or more features use gets a group in `DataSourceError`. Adding a group breaks every exhaustive `when` on
it, which is the point when the source is shared and a waste when it is not.

**One style.** Every mapper is an extension, `Throwable.toXError()` or `XError.toYError()`, used as
`Either.catch(onError = Throwable::toRemoteError).mapLeft(DataSourceError::toAuthError)`.

Rejected:
- A shared `ErrorMapper` interface with a registry: dispatch loses the compiler's exhaustiveness check (ADR 14).
- Putting Firebase and Credential Manager errors in `DataSourceError`: every feature's `when` would handle sign-in
  failures it never meets, or fall back to `else`.
- A Retrofit `CallAdapter` returning `Either` directly: worth it once about ten API calls repeat the same `Either.catch`.
- A typed-errors library (Arrow `Raise`): a new dependency and style to replace a few `when` blocks.

## Consequences

Retrofit's exceptions are known in one place, so App Check's rejection or a new error code is added once, and every
feature reads the API's error codes the same way. A feature with its own errors writes a five-line `when`. Feature
translations are tested with values, not exceptions. Auth now needs `core/network` as well as `core/common`; it always
needed the app's Retrofit setup, so moving auth means copying `core` along. `AuthError` lost `SessionEnded`, which
nothing produced, and `Unknown`, which the UI showed exactly like `SignInFailed`.
