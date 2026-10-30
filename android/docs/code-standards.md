# Code standards

## Conventions

- **Screens:** `XScreen` (stateful) + `XContent` (stateless, previewable, testable without Hilt).
- **State:** immutable data class; sealed interface when states are exclusive; `ImmutableList` for lists. Never
  parallel booleans such as `isLoading` + `hasError`.
- **Errors:** repositories return `Either<AppError, T>`. Each data source has one mapper (`Throwable.toApiError()`)
  used through `Either.catch(onError = ...)`; it maps only known exception types and sends the rest to `unexpected()`.
  Layers in between pass errors through. The UI maps them once with `AppError.toUiError()`, and a feature maps its own
  `AppError.Feature` reasons. No `Throwable` in `AppError` or UI state
  ([ADR 10](decisions/0010-use-either-and-two-boundary-error-mapping.md)).
- **Coroutines:** inject `DispatcherProvider`, never reference `Dispatchers.IO` directly; never swallow
  `CancellationException`.
- **Use cases:** only for real logic or reuse. No pass-through wrappers; JobFlow has none yet.
- **DI:** Hilt; interfaces in `domain/`, implementations in `data/`, all `@Binds` in `di/RepositoryModule`, network
  objects in `di/NetworkModule`.
- **Navigation:** Navigation 3; each feature exposes `XRoute : NavKey` and `XScreen`; `NavGraph.kt` owns the graph.
- **Strings and spacing:** text from `res/values/strings.xml`, spacing from `ui/theme/Spacing`, colors from the JobFlow
  tokens in `ui/theme/Color.kt` and type from `MaterialTheme`. Wrapper-sent text (messages, requirement names) is
  shown as it arrives.
- **Dependencies:** versions only in `gradle/libs.versions.toml`.
- **File size:** split a ViewModel or screen that passes ~400 lines. Large ViewModels are the usual way a clean
  structure rots.

## How much structure per feature

The dependency direction is fixed. The number of layers is the developer's call
([ADR 5](decisions/0005-scale-structure-with-feature-complexity.md)). Start at the lowest level that fits and move up
when a concrete pain appears:

| Level | Shape                                                                                                    | Example       |
|-------|----------------------------------------------------------------------------------------------------------|---------------|
| 0     | screen, ViewModel, repository interface; one model shared by `ui/` and `domain/`; no use case, no mapper | `ui/settings` |
| 1     | add a use case for real or shared logic; split entity/DTO from the domain model when shapes differ       | `ui/home`     |
| 2     | value objects and invariants in `domain/` when business rules need guarding                              | none yet      |
| 3     | Gradle modules, only when build time, ownership or compiler-enforced boundaries justify it               | none yet      |

Logic or a repository used by several features goes in `domain/`, never inside one feature.

## Testing

- ViewModels and use cases: plain JVM tests with fakes of domain interfaces and `Dispatchers.setMain`; no mocking
  library. Shared fakes and fixtures live in the test `testing` package (`FakeHealthRepository`, `healthFixture`).
- Assert on `state.value` and collected effects, not on internal calls. One behaviour per test, named after the
  behaviour. Cover the failure path with a fake that returns `Either.Left(AppError...)`.
- Wire contracts: parse the wrapper's checked-in examples with the production `ApiJson`; never copy fixture JSON.
- Add Compose tests against `XContent` only when a screen has non-trivial rendering.

## Automated checks

- **Konsist** (`app/src/test/.../architecture/ArchitectureTest.kt`) fails the unit tests when `ui/` imports `data/`,
  `domain/` imports Android, Room or DataStore, one `ui/<feature>` imports another, or code outside `core/common`,
  `data/remote` and `data/local` catches exceptions. Features are discovered from the package layout, so new screens
  are covered without editing the test.
- **Contract tests** (`app/src/test/.../data/remote/`) fail when the wrapper's examples or error codes change and the
  DTOs or `ApiErrorCode` do not follow.
- **detekt** (`config/detekt/detekt.yml`, defaults plus a few relaxations) flags code smells. **ktlint** checks
  formatting with `.editorconfig` (`./gradlew ktlintFormat` fixes it).
- **`DocsTest`** (`app/src/test/.../docs/DocsTest.kt`, part of the unit tests) fails when docs link to or name files
  that no longer exist, when the package map misses a top-level package, or when a doc repeats a verify command that
  differs from `AGENTS.md`.
- **Where they run:** agent hooks while an agent edits, the workspace pre-commit hook (`../.githooks/pre-commit`, enable
  with `git config core.hooksPath .githooks` at the workspace root) running ktlint and detekt, and CI
  (`../.github/workflows/android.yml`) running the full verify command from `AGENTS.md`. CI is the authoritative gate; the others give earlier feedback and can be
  skipped.
- A check that blocks a legitimate case is a conversation, not a wall: change the rule in a reviewed commit and record
  why in an ADR.

## Definition of done

The verify command in `AGENTS.md` passes, new ViewModel or use case logic has a unit test with fakes, and anything that
changed structure, commands or conventions is reflected in `docs/` or a new ADR.
