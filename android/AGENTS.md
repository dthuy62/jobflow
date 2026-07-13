# JobFlow Android Agent Instructions

Scope: this file governs work under `android/`. It is the shared instruction
source for coding agents; vendor-specific files such as `CLAUDE.md` should
reference it rather than duplicate it.

Read `../AGENTS.md` and `../docs/system-architecture.md` first when a task
touches the wrapper API, product architecture, security boundaries, or shared
documentation.

## Role

You are a senior Android maintainer for JobFlow. Preserve the current
architecture, make small reviewed changes, and verify behavior with the
cheapest relevant check. Optimize for correctness, privacy, and readable diffs.

## Commands

Run Android commands from `android/`.

```bash
./gradlew testDevDebugUnitTest
./gradlew assembleDevDebug
./gradlew lintDevDebug
./gradlew qualityCheck
```

Use `devDebug` unless the task explicitly targets release/prod. The dev flavor
uses `http://10.0.2.2:3000` for emulator access to the local wrapper.

Wrapper smoke check when Android API integration changes:

```bash
cd ../career-ops-wrapper
npm run dev -- --workspace /path/to/career-ops
curl http://127.0.0.1:3000/api/v1/health
```

## Stack

- Android Gradle Plugin 9.2.1, Gradle Kotlin DSL
- Kotlin 2.4.0, KSP 2.3.9
- compileSdk/targetSdk 37, minSdk 24
- Jetpack Compose BOM 2026.06.00, Material 3
- AndroidX Activity Compose 1.13.0, Lifecycle 2.11.0
- Room 2.8.4
- Retrofit 3.0.0, OkHttp 5.4.0
- kotlinx.coroutines 1.11.0, kotlinx.serialization 1.11.0
- JUnit 4.13.2, AndroidX Test Core 1.7.0, Robolectric 4.16.1

Keep versions in `gradle/libs.versions.toml`. Do not add dependencies when the
stdlib, AndroidX, Compose, Room, Retrofit, OkHttp, or kotlinx.serialization
already covers the need.

## Project Map

| Path | Responsibility |
| --- | --- |
| `app/src/main/java/me/dthuy/jobflow/core/` | Tiny shared primitives: `Either`, error types, response mapping |
| `app/src/main/java/me/dthuy/jobflow/data/remote/` | Retrofit service/client/interceptors |
| `app/src/main/java/me/dthuy/jobflow/data/models/` | API DTOs and DTO-domain mappers |
| `app/src/main/java/me/dthuy/jobflow/data/database/` | Room database, entities, DAOs |
| `app/src/main/java/me/dthuy/jobflow/data/datasource/` | Thin wrappers over network/database IO |
| `app/src/main/java/me/dthuy/jobflow/data/repository/` | Repository implementations and data-domain translation |
| `app/src/main/java/me/dthuy/jobflow/domain/` | Domain models, repository contracts, use cases |
| `app/src/main/java/me/dthuy/jobflow/presentation/` | Compose UI, MVI state/intents/effects, ViewModels |
| `app/src/main/java/me/dthuy/jobflow/ui/theme/` | Theme, colors, typography |
| `app/src/dev/` | Dev-only manifest/resources/network security |
| `app/src/prod/` | Prod-only resources |
| `app/src/test/` | JVM unit tests and Robolectric tests |
| `../career-ops-wrapper/` | Local backend API. Android consumes it; it owns workspace access |

## Architecture Rules

- Direction is `presentation -> domain -> data`. Do not invert it.
- Compose calls ViewModels. ViewModels call use cases. Use cases call domain
  repositories. Repositories call data sources.
- UI must not import Retrofit services, Room DAOs, API DTOs, or database
  entities.
- DTOs are transport concerns in `data/models/`; domain models are app
  semantics in `domain/model/`.
- Add wrapper API features in this order: contract example or DTO test,
  `JobFlowApiService`, data source, repository, use case/ViewModel, UI.
- Keep `AppContainer` as the dependency locator until the project explicitly
  adopts DI. Do not introduce Hilt/Koin for one feature.
- Preserve the current MVI shape: immutable `UiState`, sealed `UiIntent`, and
  one-shot `UiEffect`.
- Prefer existing `presentation/component/NeoBrutalist.kt` components and
  `ui/theme/` tokens. Do not replace the app with generic Material surfaces.

## Code Style Examples

Repository methods should keep network response handling and DTO mapping out
of ViewModels:

```kotlin
override suspend fun getHealth(): Either<DataSourceError, Health> {
    return when (val result = attempt { networkDataSource.getHealth() }) {
        is Either.Left -> result
        is Either.Right -> result.value.toDomain().right()
    }
}
```

ViewModels should mutate state through intents and keep one-shot UI events in
`SharedFlow` effects:

```kotlin
fun handleIntent(intent: ArenaUiIntent) {
    when (intent) {
        is ArenaUiIntent.LoadTasks -> loadTasks()
        is ArenaUiIntent.UpdateFilter -> updateFilter(intent.filter)
        else -> Unit
    }
}
```

Do not expose mutable flows, launch blocking work on the main thread, or put
transport DTOs in UI state.

## Career Ops Boundary

- Android calls `../career-ops-wrapper/` through `/api/v1`; it never reads or
  writes Career Ops workspace files directly.
- Android must not send shell commands, executable names, script paths, raw
  filesystem paths, or user-controlled command arguments to the wrapper.
- The wrapper owns workspace containment, command allowlists, file safety,
  Local Pairing Token enforcement, and opaque IDs for offers/reports/artifacts.
- Use `../career-ops-wrapper/contracts/examples/` as API evidence when DTOs
  change.
- Read `../career-ops-wrapper/README.md` before changing wrapper integration.

## Testing

Run the smallest check that can fail for the change.

| Change | Required check |
| --- | --- |
| DTO, serialization, API client, repository mapping | `./gradlew testDevDebugUnitTest` |
| ViewModel/use case branch | Focused unit test plus `testDevDebugUnitTest` |
| Compose layout only | `./gradlew assembleDevDebug` |
| Gradle/flavor/manifest/network config | `./gradlew assembleDevDebug` and relevant lint/test |

Add one focused test for new branches, parsing, persistence, network mapping,
or security-sensitive behavior. Do not delete or weaken failing tests without
explicit user approval.

## Git Workflow

- Inspect `git status --short` before editing.
- Run `./gradlew installGitHooks` once per clone/worktree. The tracked pre-commit hook runs `qualityCheck`; use `./gradlew ktlintFormat` to fix formatting before staging.
- Keep diffs scoped to the requested task.
- Do not stage, commit, rebase, push, or create PRs unless asked.
- Never revert user changes. If user edits overlap the task, adapt to them.
- Final response must name changed files and checks run.

## Boundaries

Always:
- Search existing code with `rg` before adding patterns.
- Prefer deleting or reusing code over new abstractions.
- Keep secrets, local paths, CV/profile content, and pairing tokens out of logs.
- Let `CancellationException` propagate.

Ask first:
- Adding dependencies or changing pinned versions.
- Changing package names, module structure, app IDs, signing, or CI.
- Touching production network/security config.
- Editing backend contracts and Android behavior in the same task.

Never:
- Commit secrets, release keystores, tokens, provider API keys, or real local
  workspace paths.
- Add generic wrapper execution endpoints such as `/run`, `/exec`, or
  `/command`.
- Make UI depend directly on Room, Retrofit, or wrapper DTOs.
- Replace architecture for a single feature.
- Hide failures by weakening validation, deleting tests, or swallowing errors.
