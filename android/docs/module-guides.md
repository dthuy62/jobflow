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
[ADR 13](decisions/0013-keep-auth-self-contained-with-one-session-source.md). Read `AuthRepository.session` to know who is
signed in. Start a sign-in from a ViewModel, passing it `requestGoogleIdToken(context, webClientId)` to run: as in
`SettingsViewModel`, the ViewModel's scope survives rotation and blocks a second tap. To clear data of your own when the
session changes, implement `SessionObserver` and register it with `@IntoSet`, as `FeedSessionCleanup` does.

To reuse auth in another project, copy `domain/auth`, `data/auth`, `ui/auth`, `di/AuthModule.kt`, `core/common` and
`app/src/main/res/values/strings_auth.xml`.

Session rules are tested on the JVM with `FakeIdentityProvider`. What a fake cannot prove runs the real SDK against the
local Auth emulator, outside the verify command because it needs a device. With an emulator or device connected:

```bash
firebase emulators:start --only auth --project demo-jobflow
./gradlew connectedDevDebugAndroidTest
```

| Case | Result | Proven by |
|---|---|---|
| First open | `SignedOut`, no user created | Auth emulator |
| Start a guest; start again | One guest, same uid | Auth emulator |
| Guest again after this install's guest | Refused, only Google is offered | Unit |
| Guest links Google | Same uid, `Member`, cache kept | Auth emulator |
| Guest picks a Google account already used here | New uid, guest's cache removed, guest's server data left behind until the merge | Auth emulator |
| That Google account is disabled | `AccountDisabled`, the guest stays | Auth emulator |
| Account disabled while in use | Session ends when the token refreshes | Auth emulator |
| Account deleted while in use | Session ends when the token refreshes | Not proven: the emulator answers differently from the docs |
| Sign out | `SignedOut`, feed removed, no guest | Auth emulator, unit |
| Restart with a stored session | Known at once, no signed-out flash | Auth emulator, one manual run |
| Network failure, 5xx, `AUTH_UNAVAILABLE`, API 401 | Session kept, error shown | Unit |
| Failed command; failing observer | Session unchanged; session and other observers unaffected | Unit |
| Second tap while a sign-in runs | Ignored | Unit |
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
6. `AuthRepositoryImpl` calls `deleteAllFeeds` when the session ends and `deleteFeedsExcept` whenever the session changes.
   A later per-user table joins both, and `deleteUnusedJobs` must keep any job it references.

DAO tests run real SQL on the JVM (`FeedDaoTest`). `@Upsert` does not work there: it reads the error code from the
message of `SQLException`, which the Android stub drops. Use `@Insert(onConflict = REPLACE)`, and no foreign key to a
table written that way, because a replace would cascade. A replace also rewrites the whole row, so job detail goes in its
own table keyed by `jobId`, not in `JobEntity`.

## Change the app identity

Package, applicationId, app name, flavors and Firebase change only through the `mobile-app-config` plugin
([ADR 4](decisions/0004-change-identity-via-mobile-app-config.md)). Steps: skill `setup-starter`.
