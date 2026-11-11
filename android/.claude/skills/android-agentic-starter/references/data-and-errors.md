# Data, errors and coroutines

- Repositories return `Either<DataSourceError, T>`, or a feature's own error (Left is the error). Wrap each API call with
  `Either.catch(onError = Throwable::toRemoteError) { api.call() }` (`core/network`); it rethrows `CancellationException`.
- Errors change shape at three boundaries (ADR 16): one mapper per SDK (`toRemoteError`, `toLocalError`, or a feature's
  own SDK mapper in its adapter), a pure `when` for a feature with its own failures (`DataSourceError.toAuthError()`),
  and an exhaustive `toUiError()` per error type. Layers in between pass errors through.
- SDK mappers match known exception types only and send anything else to `unexpected()`. Never put a `Throwable` or an
  exception message in an error or UI state; log it at the mapping boundary.
- An API error code that is a normal branch (for example `CONFLICT`) goes into the success type. A feature with failures
  of its own gets a sealed `<Feature>Error` whose every case changes what the user sees (`docs/module-guides.md`, auth
  is the model). A source two features use becomes a `DataSourceError` group.
- Only `core/common`, `core/network`, `data/remote`, `data/local` and `data/auth` may catch exceptions (Konsist).
- Inject `DispatcherProvider`; never reference `Dispatchers.IO` directly.
- Add a use case only for real logic or reuse. No pass-through use cases.
- Interfaces go in `domain/repository`, implementations in `data/`, one `@Binds` in `di/RepositoryModule.kt`; network
  objects in `di/NetworkModule.kt`.
- API DTOs mirror `../contracts/openapi.json` in `data/remote/dto`; wire enums get an `UNKNOWN` entry. Test them
  against `../contracts/examples` with the production `ApiJson`. Steps: `docs/module-guides.md`.
- Avoid primitive obsession for finite or risky concepts: enums, sealed types or `@JvmInline value class` instead
  of raw `String`, `Int` or `Boolean`. Parse wire values at the `data/` boundary.
- Prefer AndroidX/Jetpack or a maintained library over a hand-written helper. Versions go only in
  `gradle/libs.versions.toml`.
- Product data goes through the hosted API; platform SDKs through one adapter in `data/`.
