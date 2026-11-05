# 14. Give a feature its own error type when it has its own failures

Status: Accepted (2026-11-05)

## Context

ADR 10 sent every failure through `AppError`, with `AppError.Feature(FeatureError)` for a feature's own failures. No
feature used that yet. Auth showed the cost: `Either<AppError, T>` does not say which failures can happen, a sign-in cannot
fail with `StorageFailure` but the compiler does not know, and `AppError` tied auth to the rest of the app. The owner also
wants a recipe an AI agent can follow without judgement calls.

## Decision

A feature with failures of its own defines a sealed `<Feature>Error`. Its repository returns `Either<<Feature>Error, T>`,
one `<Source>ErrorMapper` object per data source maps exceptions to it, and an exhaustive `toUiError()` in its UI code
maps it to the shared `UiError`. Auth is the first: `AuthError`, `FirebaseAuthErrorMapper`, `AuthApiErrorMapper`, `GoogleCredentialErrorMapper`.

A feature whose failures are only the API's or the database's keeps `AppError` and its mappers. `AppError.Feature` and
`FeatureError` are removed. `UiError` moves to `core/common`, so any feature can produce it without importing `ui/components`.

Mapping still happens only at the two boundaries of ADR 10, and `CancellationException` is still always rethrown.

Rejected: an `ErrorMapper` interface (nothing calls mappers through it, and they are pure functions, so there is nothing to
fake; `Either.catch(onError = ...)` is already the seam); a sealed error per data source in front of every feature mapper (a
second step with one consumer, except for the API, where `AppError` already plays that role); a mapper for every feature
(boilerplate for a feature like health that has no failures of its own).

## Consequences

Signatures say what can fail, and `when` is exhaustive per feature. Adding such a feature costs a sealed type, a mapper and
a UI mapping. Credential Manager's mapper stays in `ui/auth` because it needs an Activity and `ui/` cannot import `data/`, so
auth has several mappers. This replaces the `FeatureError` part of ADR 10; the rest of it stands.
