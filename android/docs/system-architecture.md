# System architecture

## Layers

```mermaid
flowchart LR
    UI["ui/feature<br/>Screen + ViewModel"] --> UC["domain/usecase<br/>only for real or shared logic"]
    UI --> PORTS
    UC --> PORTS["domain/repository<br/>interfaces (ports)"]
    DATA["data/<br/>Retrofit"] -. implements .-> PORTS
    DI["di/<br/>Hilt @Binds / @Provides"] -. wires .-> DATA
    DATA -- HTTPS --> API["Hosted API<br/>(contract in ../contracts)"]
```

- `ui/` depends on `domain/`. `domain/` depends on Kotlin only. `data/` depends on `domain/`.
- The domain defines ports (`HealthRepository`); `data/` implements them; `di/RepositoryModule`
  binds them. Replacing Retrofit or adding a cache touches `data/` plus one binding.
- Product data comes only from the hosted API; the backend owns authorization, user data and job sources
  (`../../docs/system-architecture.md`). Firebase Auth is the one other service: it says who the user is
  ([Authentication](#authentication)).
- It is one Gradle module on purpose ([ADR 1](decisions/0001-use-a-single-app-module.md)). The compiler cannot stop
  `ui/` from importing `data/`, so Konsist tests do (see [code standards](code-standards.md#automated-checks)).
- How many layers a feature really needs is a per-feature decision
  ([ADR 5](decisions/0005-scale-structure-with-feature-complexity.md)); the direction above is the only fixed part.

## Presentation patterns: which, when

Both share one idea: **unidirectional data flow with a single immutable state**.

|                 | MVVM-lite (default)                   | MVI                                                                                               |
|-----------------|---------------------------------------|---------------------------------------------------------------------------------------------------|
| State           | one `UiState` in a `StateFlow`        | one `State` in a `StateFlow`                                                                      |
| Input           | public functions on the ViewModel     | one `onIntent(Intent)` entry point                                                                |
| One-shot events | avoid; model as state if possible     | `Effect` channel + `CollectEffects`, for navigation only                                          |
| Pick it when    | simple screens, settings, small forms | interdependent state, async work with ordering, navigation events, you want inputs logged         |
| Example         | `ui/settings`                         | `ui/home`                                                                                         |

Start with MVVM-lite. Move a screen to MVI when you would add a third boolean flag, a `SharedFlow` for events, or you
hit ordering bugs between async calls. Never mix both in one screen. Why this split and not MVC, MVP or many flows per
screen: [ADR 2](decisions/0002-default-to-mvvm-lite-and-use-mvi-when-needed.md).

```mermaid
flowchart LR
    V["View<br/>XScreen / XContent"] -- "onIntent(intent)" --> VM["MviViewModel"]
    VM -- "setState { copy(...) }" --> S["StateFlow&lt;State&gt;"]
    S --> V
    VM -- "sendEffect(effect)" --> E["Effect channel<br/>one-shot"]
    E --> V
```

## Checking API health

Home is the reference for async work, caching and one-shot effects.

```mermaid
sequenceDiagram
    participant U as User
    participant S as HomeScreen
    participant V as HomeViewModel
    participant R as HealthRepositoryImpl
    participant A as JobFlowApi
    S->>V: created (init)
    V->>R: refresh(force = false)
    alt fresh READY answer cached (< 3 h)
        R-->>V: cached HealthSnapshot
    else stale, failed, not ready or forced
        R->>A: GET api/v1/health
        A-->>R: HealthDto or exception
        R->>R: Either.catch(Throwable::toApiError), toDomain(), checkedAt = clock
        R-->>V: HealthSnapshot (also published on latest)
    end
    V-->>S: state.health, showUnhealthyDialog (once)
    U->>S: tap Details in the dialog
    S->>V: onIntent(OpenHealthDetails)
    V-->>S: Effect NavigateToSettings
```

`HealthRepositoryImpl` is an app singleton, so Home and Settings share one cache and one `latest` stream. Only a
OK answer is reused: failures and degraded answers are checked again, so tapping Check again (or reopening the app)
recovers at once.

## Network

- `data/remote/JobFlowApi.kt` declares the endpoints under `api/v1/`. Calls are `suspend` and throw on failure. Health
  returns a `Response`, because `healthOrThrow` treats its 503 with a health body as an answer.
- `di/NetworkModule.kt` builds one `OkHttpClient` with the bearer token interceptor and authenticator (health needs no
  token) and one `Retrofit` using `ApiJson` (`ignoreUnknownKeys = true`).
- The base URL comes from the flavor: `BuildConfig.API_BASE_URL`. Only `dev` allows cleartext, and only to
  `10.0.2.2` and `localhost` (`app/src/dev/res/xml/network_security_config.xml`).
- DTOs in `data/remote/dto` mirror the hosted contract. Wire enums map unknown values to `UNKNOWN` instead of
  failing. `ApiContractCompatibilityTest` parses every example in `../contracts/examples`.

## Authentication

Firebase says who the user is; the API decides what they may do and creates their row on their first authenticated call.
The app only displays `isAnonymous`, it never authorizes with it.

| Piece | Job | Never |
|---|---|---|
| `ui/auth/AuthViewModel.kt` | Sign-in state and commands for any screen; blocks a second tap and survives rotation | Asks the API about the account |
| `ui/auth/GoogleCredentials.kt` | Shows Google's sheet, which needs an Activity, and returns an ID token | Holds session logic |
| `domain/auth` | `Session`, `AuthError`, `GuestPolicy`, and the `AuthRepository` and `SessionObserver` ports | Knows Firebase or Android |
| `data/auth/AuthRepositoryImpl.kt` | The one source of who is signed in; runs observers before publishing a change | Knows Firebase, or what the app stores |
| `data/auth/FirebaseIdentityProvider.kt` | The only class that calls Firebase Auth | Holds product rules |
| `data/auth/BearerToken.kt` | Adds the token, and retries a 401 once with a fresh one | Creates a user |

Auth imports only itself and `core/common`, which Konsist enforces, so it can move to another project
([ADR 13](decisions/0013-keep-auth-self-contained-with-one-session-source.md)). The app plugs in through `SessionObserver`:
`FeedSessionCleanup` removes other users' feeds. `AccountRepository`, which is not part of auth, is what the API knows about
the user: `SettingsViewModel` checks it, and `accountUiState` merges that check with `AuthViewModel`'s state for the card.

- `Session` is `Unknown` (Firebase has not answered), `SignedOut`, `Guest` or `Member`. It is known offline, so navigation
  must read it and not `GET /me`.
- A guest starts only through `continueAsGuest()`, once per install (`GuestLedger`). Signing out does not start one, and
  after the install's guest only Google is left. Uninstalling resets it. This is a product rule, not abuse protection:
  the API's limits and, from phase 3, Play Integrity are what stop scripts.
- When a guest picks a Google account already used here, the backend merges their data (planned for phase 2, see the
  product design). Until then it stays behind on the server.
- **Two channels.** A command that fails returns `Either.Left` and the session stays as it was. A session that changes for
  any other reason (an account deleted on the web) is only a new `session` value, so screens need no code for it.
- **Only an account Firebase no longer accepts ends a session** (`FirebaseAuthInvalidUserException`). A network failure, a
  5xx, `AUTH_UNAVAILABLE` or a 401 from the API keeps it: signing a guest out loses their identity for good.

| Change | Session | Cached feed |
|---|---|---|
| A guest links Google (same uid) | `Member` | Kept |
| A guest picks a Google account already used here (new uid) | `Member` | Guest's removed; their server data stays behind |
| Sign-out, or the account is deleted or disabled | `SignedOut` | Removed |

## Errors

Expected failures are values: repositories return `Either<AppError, T>` (Left is the error)
([ADR 10](decisions/0010-use-either-and-two-boundary-error-mapping.md)). Errors change shape at exactly two places:

```mermaid
flowchart LR
    X["Exception in data/<br/>(IO, HTTP, serialization)"] --> M["source mapper<br/>Throwable.toApiError()"]
    M --> L["Either.Left(AppError)"]
    L --> P["repository / ViewModel<br/>pass through, intercept business cases"]
    P --> U["AppError.toUiError()<br/>string resource + action"]
```

- One mapper per data **source**, not per feature. It knows the SDK's exception types and nothing else does. Unknown
  exceptions go to `unexpected()`: rethrown in debug, logged and mapped to `AppError.Unknown` in release.
- `AppError` holds no `Throwable`, so states compare equal and exception text never reaches the UI.
- An API error code (`ApiErrorCode`, mirrored from `contracts/error-codes.json` and checked by `ApiErrorCodeContractTest`) that
  is a normal branch of a flow becomes part of the success type.
- A feature with failures of its own has its own sealed error type and mappers instead of `AppError`
  ([ADR 14](decisions/0014-give-a-feature-its-own-error-type-when-it-has-its-own-failures.md)). Auth is the first.
- `CancellationException` is always rethrown. Konsist fails the build if `ui/` or `domain/` catches exceptions.

## Dependency injection and lifetimes

Hilt wires everything. Interfaces live in `domain/`, implementations in `data/`, bindings in `di/RepositoryModule`;
`NetworkModule`, `TimeModule` and `CoroutinesModule` provide Retrofit, `Clock` and `DispatcherProvider`. Lifetimes are
listed in the [codebase summary](codebase-summary.md#lifetimes).

## Navigation

Navigation 3 with three top-level tabs (`navigation/TopLevelTab.kt`): Home, Inputs and Settings. Selecting a tab
replaces the back stack with `topLevelStack(tab)`, which always keeps `HomeRoute` at the bottom, so back from any tab
returns Home and `HomeViewModel` is never cleared while the app runs. Each feature exposes `XRoute : NavKey` and
`XScreen`; `navigation/NavGraph.kt` is the only place that knows every feature and passes navigation to screens as
callbacks. Two entry decorators (saved-state holder, then ViewModel store) scope `hiltViewModel()` to the back stack
entry. The bottom bar draws a blurred copy of the page behind it (kyant backdrop), so pages receive the scaffold's
`contentPadding` and scroll under it.

## Working with AI agents

Agents start from `AGENTS.md` and load skills (`.claude/skills/`) and path-scoped rules (`.claude/rules/`) on demand.
Decisions and their reasons live in `decisions/`, one file per decision.
