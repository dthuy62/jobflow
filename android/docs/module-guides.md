# Module guides

How-to guides for the recurring jobs. Rules and reasons are in [code standards](code-standards.md) and the ADRs.

## Home (MVI reference)

`ui/home` shows the full path: `HomeScreen` -> `HomeViewModel` (`MviViewModel<HomeState, HomeIntent, HomeEffect>`) ->
`HealthRepository` -> `HealthRepositoryImpl` -> `JobFlowApi`. The contract (`HomeContract.kt`) holds the state,
intents and effects. The sequence is in [system architecture](system-architecture.md#checking-api-health).

Use it as the model when a screen has async work, interdependent state or navigation effects.

## Settings (MVVM-lite, level 0)

`ui/settings` shows the smallest shape: one `UiState` as a `StateFlow`, plain functions for actions, and the ViewModel
injecting the repositories directly because a use case would be a pass-through. Use it as the model for forms and
simple screens.

## Authentication

The design is in [system architecture](system-architecture.md#authentication) and
[ADR 13](decisions/0013-keep-auth-self-contained-with-one-session-source.md). Read `AuthenticationService.session` to know who is
signed in. A screen that offers sign-in takes its own `AuthViewModel` and sends `AuthIntent.SignInWithGoogle` with
`requestGoogleIdToken(context, webClientId)` to run, as `SettingsScreen` does. To clear data of your own when the user changes,
implement `SessionObserver` and register it with `@IntoSet`, as `FeedSessionCleanup` does. To add a sign-in method, add it to
`SignInMethod`, follow the compile error, and write one more strategy in `SignInStrategies.kt`.

To reuse auth in another project, copy `domain/auth`, `data/auth`, `ui/auth`, `di/AuthModule.kt`, `di/AuthFirebaseModule.kt`,
`core/common`, `core/mvi` and the `error_auth_*` strings from `strings.xml`. Then provide an `@ApplicationScope` `CoroutineScope`
(`di/CoroutinesModule.kt`) and add `BearerTokenInterceptor` and `TokenAuthenticator` to the OkHttp client, with your public
routes (`di/NetworkModule.kt`).

Session rules and sagas are tested on the JVM with `AuthFakes.kt`. What a fake cannot prove runs the real SDK against the
local Auth emulator, outside the verify command because it needs a device. With an emulator or device connected:

```bash
firebase emulators:start --only auth --project demo-jobflow
./gradlew connectedDevDebugAndroidTest
```

Gradle runs these on every connected device, and uninstalls the app from each afterwards. With a phone plugged in, set
`ANDROID_SERIAL` to the emulator: on a phone they cannot reach the Auth emulator at `10.0.2.2`.

| Case | Result | Proven by |
|---|---|---|
| First open | `SignedOut`, no user created | Auth emulator, unit |
| Guest again after this install's guest | Refused, only Google is offered | Unit |
| Guest or Google, the backend confirms | Session moves only at the end | Unit |
| Provider fails | Session unchanged, backend not called | Unit |
| Backend fails after the provider | Signed out on the device, `/auth/logout` not called, can try again | Unit |
| App dies between the two | Rolled back on the next launch, before any session shows | Unit |
| Caller leaves the screen during a sign-in | The sign-in finishes | Unit |
| Guest links Google | Same uid, `Member`, observers not run | Auth emulator, unit |
| Guest picks a Google account already used here | New uid, guest token sent, observers run | Auth emulator, unit |
| That switch fails at the backend | Guest token kept, and sent on the next sign-in | Unit |
| That Google account is disabled | `AccountDisabled`, the guest stays | Auth emulator |
| Account disabled while in use | Rejected when the token refreshes; the service ends the session, after any running sign-in | Auth emulator, unit |
| Account deleted while in use | Same | Not proven: the emulator answers differently from the docs |
| Sign out | Backend told as best effort, works offline, starts no guest | Unit |
| Restart with a stored session | Known at once, no signed-out flash | Auth emulator, one manual run |
| A failing observer | Session and other observers unaffected | Unit |
| Second tap, or a command running on another screen | Ignored, and that screen shows loading | Unit |
| Google's sheet: closed, no account, no Play services | No error, `NoGoogleAccount`, `GoogleUnavailable` | Unit for the mapping; not run on a device |
| Rotate while the sheet is open | Sign-in should finish | Not proven |
| Reinstall | New guest allowed | Not proven: follows from the backup rules |

## Add a screen

```bash
scripts/new-feature.sh profile          # MVVM-lite
scripts/new-feature.sh profile --mvi    # MviViewModel + Contract file
```

It creates `ui/profile/` (Route, ViewModel, Screen + Content) and a starter ViewModel test. Then register the route in
`navigation/NavGraph.kt` with an `entry<ProfileRoute> { ProfileScreen(...) }` line (add a `TopLevelTab` entry if it is a
tab), pass any navigation as callbacks, put text in `strings.xml`, and run the verify command. Details for agents:
skill `new-feature`.

## Add an API endpoint

1. Add the DTO to `data/remote/dto` with `@Serializable`, matching `../contracts/openapi.json` field for field; optional
   fields get `= null`. Wire enums get an `UNKNOWN` entry and map through `toWireEnum`.
2. Add a parse test against the contract's example in `../contracts/examples` (use
   `contractFixture(...)` from the test `testing` package). Never copy the JSON into Android.
3. Declare the call in `JobFlowApi` (path relative, e.g. `@GET("api/v1/cv")`).
4. Implement the domain port in `data/repository/impl` with
   `Either.catch(onError = Throwable::toApiError) { api.getCv() }.map { it.toDomain() }`.
5. If an API error code means something to this feature, intercept it in the repository: a normal branch goes into
   the success type. If the UI shows it as an error, give the feature its own error type, as in
   [Add a feature error type](#add-a-feature-error-type).

## Add a feature error type

Only for a feature with failures of its own ([ADR 14](decisions/0014-give-a-feature-its-own-error-type-when-it-has-its-own-failures.md));
otherwise keep `AppError`. Auth is the model.

1. Define a sealed `<Feature>Error`. Each case must change what the user sees or can do.
2. Return `Either<<Feature>Error, T>` from the repository.
3. Write one `<Source>ErrorMapper` object per data source, used as `Either.catch(onError = AuthErrorMapper::fromFirebase)`.
   It matches known exception types, rethrows `CancellationException` and sends the rest to `unexpected()`.
4. Write an exhaustive `toUiError()` with no `else` in the feature's UI code, and test each case's action and message.

## Share logic between features

A use case or repository used by two features lives in `domain/`, not inside either feature. Both ViewModels inject it.
Features never import each other; if one must open the other, `NavGraph.kt` passes a callback. UI pieces shared by
several features live in `ui/components` or `ui/health`.

## Add local storage (Room)

Room 3 (`androidx.room3`, [ADR 6](decisions/0006-use-room-3.md)) holds a cache of API data, not a source of truth, in
`data/local`. No screen reads it yet: the first feature of phase 2 does. Models and mappers follow
[ADR 12](decisions/0012-one-model-per-layer-with-room.md):

| Model | Example | Where | Maps with |
|---|---|---|---|
| DTO | `JobSummaryDto` | `data/remote/dto` | `toEntity()`, in the entity's file |
| Entity | `JobEntity` | `data/local/entity` | `toDomain()`, in the entity's file |
| Domain | `Job` | `domain/model` | nothing: it knows no other layer |
| UI state | `HealthUiState` | `ui/<feature>` | `toUiState()`, in `ui/<feature>` |

A cached feature reads `API -> DTO -> Entity -> Room -> Domain -> UI`: the screen observes Room, and a refresh only writes
to Room. Data that is not cached, like health, goes straight from DTO to domain.

1. Add an entity in `data/local/entity` and a DAO in `data/local/dao`, list the entity in `JobFlowDatabase`, and provide
   the DAO in `DatabaseModule`. Per-user data has `ownerUserId` in its key; public data like a job does not.
2. Keep wire enums as strings in the entity and parse them in `toDomain()`. Parse timestamps to epoch millis in
   `toEntity()`, and call `toEntity()` inside `Either.catch(onError = Throwable::toApiError) { ... }`, not in a later
   `.map`, so a malformed one becomes `InvalidResponse` and reading a row cannot fail.
3. Wrap suspend calls with `Either.catch(onError = Throwable::toLocalError) { ... }`. That does not cover a DAO's `Flow`,
   which fails when collected: map it to `Either` and add `.catch { emit(Either.Left(it.toLocalError())) }`.
4. Because the database is a rebuildable cache, a destructive migration is acceptable, and `DatabaseModule` uses one.
5. Expose cached data with its sync time and last refresh error instead of replacing data with an error.
6. `FeedSessionCleanup` calls `deleteAllFeeds` when nobody is signed in and `deleteFeedsExcept` whenever the user changes.
   A later per-user table joins both, and `deleteUnusedJobs` must keep any job it references.

DAO tests run real SQL on the JVM (`FeedDaoTest`). `@Upsert` does not work there: it reads the error code from the
message of `SQLException`, which the Android stub drops. Use `@Insert(onConflict = REPLACE)`, and no foreign key to a
table written that way, because a replace would cascade. A replace also rewrites the whole row, so job detail goes in its
own table keyed by `jobId`, not in `JobEntity`.

## Change the app identity

Package, applicationId, app name, flavors and Firebase change only through the `mobile-app-config` plugin
([ADR 4](decisions/0004-change-identity-via-mobile-app-config.md)). Steps: skill `setup-starter`.
