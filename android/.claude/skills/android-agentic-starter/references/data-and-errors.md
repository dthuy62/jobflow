# Data, errors and coroutines

- Repositories return `Either<AppError, T>` (Left is the error). Wrap each source call with
  `Either.catch(onError = Throwable::toApiError) { api.call() }` from `core/common`; it rethrows `CancellationException`.
- Errors change shape only at two boundaries: the source mapper in `data/` (`toApiError` for the API, later
  `toLocalError` for Room) and `AppError.toUiError()` in `ui/components`. Layers in between pass errors through.
- Mappers match known exception types only and send anything else to `unexpected()`. Never put a `Throwable` or an
  exception message in `AppError` or UI state; log it at the mapping boundary.
- An API error code that is a normal branch (for example `CONFLICT`) goes into the success type. A failure
  the feature shows as an error becomes `AppError.Feature(<feature's sealed FeatureError>)`; the feature's screen maps it
  exhaustively and falls back to `toUiError()` for the rest.
- Only `core/common`, `data/remote` and `data/local` may catch exceptions (Konsist enforces it).
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
- Everything goes through the hosted API.
