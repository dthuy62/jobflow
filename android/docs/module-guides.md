# Module guides

How-to guides for the recurring jobs. Rules and reasons are in [code standards](code-standards.md) and the ADRs.

## Home (MVI reference)

`ui/home` shows the full path: `HomeScreen` -> `HomeViewModel` (`MviViewModel<HomeState, HomeIntent, HomeEffect>`) ->
`HealthRepository` -> `HealthRepositoryImpl` -> `CareerOpsApi`. The contract (`HomeContract.kt`) holds the state,
intents and effects. The sequence is in [system architecture](system-architecture.md#checking-wrapper-health).

Use it as the model when a screen has async work, interdependent state or navigation effects.

## Settings (MVVM-lite, level 0)

`ui/settings` shows the smallest shape: one `UiState` as a `StateFlow`, plain functions for actions, and the ViewModel
injecting the repositories directly because a use case would be a pass-through. Use it as the model for forms and
simple screens.

## Add a screen

```bash
scripts/new-feature.sh profile          # MVVM-lite
scripts/new-feature.sh profile --mvi    # MviViewModel + Contract file
```

It creates `ui/profile/` (Route, ViewModel, Screen + Content) and a starter ViewModel test. Then register the route in
`navigation/NavGraph.kt` with an `entry<ProfileRoute> { ProfileScreen(...) }` line (add a `TopLevelTab` entry if it is a
tab), pass any navigation as callbacks, put text in `strings.xml`, and run the verify command. Details for agents:
skill `new-feature`.

## Add a wrapper endpoint

1. Add the DTO to `data/remote/dto` with `@Serializable`, matching the wrapper's Zod schema field for field; optional
   fields get `= null`. Wire enums get an `UNKNOWN` entry and map through `toWireEnum`.
2. Add a parse test against the wrapper's example in `../career-ops-wrapper/contracts/examples` (use
   `contractFixture(...)` from the test `testing` package). Never copy the JSON into Android.
3. Declare the call in `CareerOpsApi` (path relative, e.g. `@GET("api/v1/cv")`).
4. Implement the domain port in `data/repository/impl` with
   `Either.catch(onError = Throwable::toApiError) { api.getCv() }.map { it.toDomain() }`.
5. If a wrapper error code means something to this feature, intercept it in the repository: a normal branch goes into
   the success type, a failure the UI shows becomes `AppError.Feature(<sealed FeatureError>)`. The screen maps its own
   `FeatureError` exhaustively and falls back to `AppError.toUiError()` for the rest.

## Share logic between features

A use case or repository used by two features lives in `domain/`, not inside either feature. Both ViewModels inject it.
Features never import each other; if one must open the other, `NavGraph.kt` passes a callback. UI pieces shared by
several features live in `ui/components` or `ui/health`.

## Add local storage (Room)

Room 3 (`androidx.room3`, [ADR 6](decisions/0006-use-room-3.md)) is not in the app yet; it comes back with Story 2.6 as
a cache of wrapper data, not a source of truth.

1. Add the room3 plugin, runtime and compiler from the version catalog, an entity and DAO in `data/local`, and a
   `DatabaseModule`.
2. Write a `toLocalError()` mapper in `data/local` next to the DAOs. Check which exception types the SQLite driver really
   throws before matching on them.
3. Because the database is a rebuildable cache, a destructive migration is acceptable; say so in the database class.
4. Expose cached data with its sync time and last refresh error instead of replacing data with an error.

## Change the app identity

Package, applicationId, app name, flavors and Firebase change only through the `mobile-app-config` plugin
([ADR 4](decisions/0004-change-identity-via-mobile-app-config.md)). Steps: skill `setup-starter`.
