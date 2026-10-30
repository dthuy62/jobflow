# 9. Use Retrofit and kotlinx.serialization for the wrapper API

Status: Accepted (2026-10-30)

## Context

The starter ships no network layer. JobFlow talks to one backend, the local Career Ops wrapper, whose contracts are Zod
schemas with checked-in JSON examples. The old app already used Retrofit with the kotlinx.serialization converter and
had contract tests built on it. Planning notes mentioned Moshi, but nothing used it.

## Decision

- Retrofit 3 with suspend functions, OkHttp 5 and the kotlinx.serialization converter; one `Json` instance (`ApiJson`,
  `ignoreUnknownKeys = true`) shared by the converter, the error-body parser and the tests.
- DTOs in `data/remote/dto` mirror the Zod schemas and map to domain models with `toDomain()`. Wire enums carry an
  `UNKNOWN` entry so values added by a newer wrapper do not fail parsing.
- Contract tests parse every example in `career-ops-wrapper/contracts/examples` directly; Android never keeps a copy.
- The base URL comes from the flavor; the pairing token header is added by `PairingTokenInterceptor`.

Rejected: Ktor client (no gain for one REST backend on Android), Moshi (a second serialization stack), and a Retrofit
`CallAdapter` returning `Either` (hides error mapping inside Retrofit and ties the API interface to `core/` types).

## Consequences

Contract drift fails the Android unit tests. Unknown additive fields and enum values are tolerated, while missing
required fields still fail. R8 must keep the serializers; check a minified build before release.
