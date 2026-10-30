# 3. Return Outcome for expected failures

Status: Superseded by 0010 (2026-10-30)

## Context

Network, database and model calls fail in expected ways. Exceptions thrown across layers leak SDK types into
ViewModels, are easy to forget, and can swallow coroutine cancellation.

## Decision

Repositories and engines return `Outcome<T>` (`Success` or `Failure(AppError)`). `data/` converts exceptions to
`AppError`, rethrowing `CancellationException`. ViewModels map `AppError` to UI state; screens map it to strings.
Rejected: throwing across layers; Kotlin `Result` (carries a raw `Throwable`).

## Consequences

Failure paths are visible in types and easy to fake in tests. Every data source needs a mapping to `AppError`,
and new error kinds need a string resource.
