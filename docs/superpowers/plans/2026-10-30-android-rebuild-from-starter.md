# Android Rebuild From Starter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `jobflow/android/` with a fresh copy of `android-agentic-starter`, then port only the JobFlow pieces worth keeping (health feature, contract DTOs, network client, contract tests, theme, bottom navigation).

**Architecture:** Single `:app` module from the starter: `ui/ → domain/ ← data/`, Hilt in `di/`, Navigation 3, `Either<AppError, T>` for expected failures (JobFlow replaces the starter's `Outcome`), `MviViewModel` for complex screens and MVVM-lite for simple ones. Konsist tests enforce the layers. The starter has no network layer, so JobFlow adds `data/remote/` (Retrofit + OkHttp + kotlinx.serialization). The Android app still talks only to the wrapper API.

**Tech Stack:** AGP 9.3.3, Kotlin 2.4.21, Compose BOM 2026.09.00, Hilt 2.60.1, Navigation 3 1.2.0, DataStore 1.2.1, Retrofit 3.0.0, OkHttp 5.4.0, kotlinx.serialization 1.11.0, Konsist, detekt 1.23.8, ktlint.

**Spec:** No separate spec. The decisions come from the 2026-10-30 session and are listed under "Decisions" below. Also read `AGENTS.md`, `docs/system-architecture.md`, and the starter's `docs/system-architecture.md` plus `docs/decisions/`.

## Decisions

| # | Decision | Reason |
|---|---|---|
| D1 | Rebuild in place under `jobflow/android/` on branch `feat/android-rebuild-from-starter`. Copy the starter from its git `HEAD` with `git archive`, not from its working tree. | Keeps the monorepo path. Avoids build/vendor junk and the starter's uncommitted files. |
| D2 | Keep identity `me.dthuy.jobflow`, `dev` (`.dev` suffix, `[DEV] JobFlow`) and `prod` flavors, and `BuildConfig.CAREER_OPS_ENVIRONMENT`/`CAREER_OPS_DEFAULT_BASE_URL`. Apply them with `mobile-app-config` using the existing `android/android-app-config.json`. | Same app on devices. The starter forbids hand renames. |
| D3 | Drop: Arena/task feature, starter chat example (`ui/chat`, `ChatEngine`, Room `ChatMessage`), Room entirely, Robolectric, `core/logging`, `NeoBrutalist.kt`, the old `core/either.kt` (its Retrofit-coupled `attempt`; `Either` itself is rewritten in Task 2), manual `AppContainer`, fastlane/Gemfile/distribute workflow. | Dead code, or not needed before Story 2.6 (Room 3 comes back then, ADR 0006 stays valid). |
| D4 | Keep: `debug.keystore.base64` + shared debug signing, launcher icons/splash resources, `assets/`, `metadata.json`, the soft palette and bottom navigation (kyant backdrop). | User-visible identity and current design. |
| D5 | **Error model.** Repositories return `Either<AppError, T>` (the user prefers `Either` to the starter's `Outcome`; Left is always the error). Errors change shape only at two boundaries. First, one mapper per data *source* in `data/` (`Throwable.toApiError()` now, `toLocalError()` with Room later), built through `Either.catch(onError) { }`. Second, one app-wide `AppError.toUiError()` in `ui/components/`. Layers in between pass errors through and only intercept cases with business meaning: a normal flow branch goes into the success type, and a failure the UI shows as an error becomes `AppError.Feature(<feature's sealed FeatureError>)`. Mappers catch only known exception types. Anything else goes to `unexpected()`, which rethrows in debug and logs then returns `Unknown` in release. `AppError` holds no `Throwable`. The wrapper's error codes are mirrored in `ApiErrorCode` (with `UNKNOWN`), and a contract test on both sides keeps them in sync. No extra wrapper (`apiCall`, `ApiCaller`, `CallAdapter`) is added; a mapper becomes an injected class only once it needs collaborators. | Matches the Android data/UI layer guidance and the Kotlin `Result` design notes; reviewed against primary sources on 2026-10-30. Keeps exceptions out of `ui/` and `domain/`, keeps `equals` stable, and fails compilation when a new error case is unhandled. |
| D6 | Health cache lives in an app-scoped `HealthRepositoryImpl`: successes stay fresh for 3 hours, failures are never served from cache. The time comes from an injected `java.time.Clock`. | Fixes the `nanoTime` "Last checked" bug. Stops a stale "unreachable" from sticking. |
| D7 | Unknown wire enum values map to an `UNKNOWN` entry instead of throwing. | Architecture contract: unknown enum values → `unknown`. |
| D8 | Tabs (Home, Inputs, Settings) are a single Nav3 back stack whose bottom entry is always `HomeRoute`. The "unhealthy dialog shows once" flag lives in `HomeViewModel` state, which survives tab switches for that reason. | No extra session object. Works with the ViewModel-store decorator. |
| D9 | User-visible copy moves to `strings.xml`. UI state carries kinds and server-provided messages, and composables map kinds to `stringResource`. | Starter convention. Testable without Android. |
| D10 | The starter's agent layer (`.claude/`, `.codex/`, `.cursor/`, `.agents`, `.opencode`, `tools/agents/`, `scripts/new-feature.sh`) and `docs/` move into `android/`. Root `.githooks/pre-commit` stays the hook entry point. CI lives in root `.github/workflows/`. | GitHub only reads root workflows. Root hook already exists. |

## Global Constraints

- Package/namespace `me.dthuy.jobflow`; `applicationId` `me.dthuy.jobflow` (+ `.dev` for dev). Sources under `app/src/main/kotlin/me/dthuy/jobflow/`.
- `minSdk = 26`, `compileSdk = targetSdk = 37`, JVM 21.
- Dev base URL `http://10.0.2.2:3000`; cleartext allowed only in `dev` for `10.0.2.2` and `localhost` (`app/src/dev/res/xml/network_security_config.xml`).
- Pairing header name `X-Career-Ops-Token`; omit the header when the token is null or blank.
- Health freshness window `3 * 60 * 60 * 1_000L` ms.
- Contract fixtures are read from `../career-ops-wrapper/contracts/examples` and are never copied into Android.
- Canonical verify command (written once, in `android/AGENTS.md`): `./gradlew assembleDevDebug testDevDebugUnitTest lintDevDebug detekt ktlintCheck`.
- Never: `ui/` importing `data/`; `domain/` importing Android/Retrofit/OkHttp/DataStore; a `ui/<feature>` importing another feature. Shared UI packages are `theme`, `components`, `health`.
- No secrets, tokens, local workspace paths or real CV data in code, fixtures or logs.

## Review Focus

1. **Wrapper is down at launch, then started.** Tapping Check again must show Ready. A failure must never be served from cache. → Task 4 `failureIsNeverServedFromCache`.
2. **LAN wrapper answers 401 because the token is missing.** The user must see "Pairing required", not "Invalid response". → Task 5 `unauthorizedMapsToPairingRequired`.
3. **A newer wrapper sends a new enum value** (e.g. `status: "maintenance"`). Parsing must not fail, and the value must map to `UNKNOWN`. → Task 3 `unknownWireValuesMapToUnknown`.
4. **"Last checked" shows local wall-clock time,** not a monotonic number. → Task 5 `checkedAtIsFormattedInLocalTime`.
5. **The R8-minified release build still parses JSON.** Retrofit and kotlinx.serialization reflection must survive shrinking. → Task 8 Step 3 (devRelease smoke run).

---

### Task 0: Preconditions

**Files:** none

- [ ] **Step 1: Confirm Story 1.6 is committed on `main`.** Run `git status --short`. Expected: no staged changes under `android/` or `career-ops-wrapper/`. If any remain, stop and ask the user to commit them. Never commit them yourself without approval.
- [ ] **Step 2: Branch.** Run `git switch -c feat/android-rebuild-from-starter`.
- [ ] **Step 3: Record the baseline.** Run `cd android && ./gradlew testDevDebugUnitTest`. Expected: BUILD SUCCESSFUL. Old sources stay readable via `git show main:android/<path>` for every later task.

### Task 1: Starter skeleton with JobFlow identity

**Files:**
- Delete: every tracked file under `android/` except `android-app-config.json`, `metadata.json`, `assets/**`, `debug.keystore.base64`
- Create: starter tree from `git -C ../android-agentic-starter archive HEAD`
- Restore from `main`: `app/src/main/res/**`, `app/src/dev/**`, `app/src/prod/**`
- Modify: `app/build.gradle.kts`, `app/src/main/AndroidManifest.xml`, `settings.gradle.kts`, `.gitignore`

- [ ] **Step 1: Swap the tree.**

```bash
cd /Users/dthuy/Workspace/jobflow
git ls-files android | grep -v -E '^android/(android-app-config\.json|metadata\.json|assets/|debug\.keystore\.base64)' | xargs git rm -q
git -C ../android-agentic-starter archive HEAD -- . ':!fastlane' ':!Gemfile' ':!Gemfile.lock' ':!.ruby-version' ':!.github' ':!.superpowers' ':!docs/superpowers' | tar -x -C android
git checkout main -- android/app/src/main/res android/app/src/dev android/app/src/prod
```

- [ ] **Step 2: Apply identity and flavors.** Run from `android/`:

```bash
TOOL=/Users/dthuy/Workspace/mobile-app-config/skills/android/scripts/mobile-app-config
python3 $TOOL package-name --application-id me.dthuy.jobflow --app-name "JobFlow" --root-project-name "JobFlow"
python3 $TOOL flavors
```

Expected result in `app/build.gradle.kts`: `namespace`/`applicationId` = `me.dthuy.jobflow`, and flavors `dev` (suffix `.dev`) and `prod`, each with the two `buildConfigField`s from `android-app-config.json`, with no `stg`. If the tool produces anything else, hand-edit to exactly that and do not re-run it. Then set `minSdk = 26` (starter value; drop 24).

- [ ] **Step 3: Port signing and manifest.** Add the `debugConfig` signing config from `main:android/app/build.gradle.kts` (`$rootDir/debug.keystore`, alias `androiddebugkey`) and use it for `debug`. Keep the starter's env-based release signing and `isMinifyEnabled = true`. In the manifest, keep the starter's `MainApplication`/`MainActivity`, and add `INTERNET`, icon, roundIcon, backup rules, `Theme.App`, and the activity theme `Theme.App.Starting` from `main:android/app/src/main/AndroidManifest.xml`. Add `debug.keystore` to `android/.gitignore`.
- [ ] **Step 4: Fix doc paths for the new package.** Run `grep -rl 'com/example/agenticstarter\|com\.example\.agenticstarter' docs .claude README.md AGENTS.md | xargs sed -i '' -e 's#com/example/agenticstarter#me/dthuy/jobflow#g' -e 's#com\.example\.agenticstarter#me.dthuy.jobflow#g'`.
- [ ] **Step 5: Verify.** Run `./gradlew assembleDevDebug testDevDebugUnitTest`. Expected: BUILD SUCCESSFUL, with `ArchitectureTest`, `DocsTest` and the starter chat/settings tests passing.
- [ ] **Step 6: Commit** `build(android): replace app with android-agentic-starter skeleton`.

### Task 2: Remove the chat example and Room, add `Either`, `AppError` and `toApiError`

**Files:**
- Delete: `ui/chat/`, `domain/engine/`, `domain/model/ChatMessage.kt`, `domain/repository/ChatRepository.kt`, `domain/usecase/*Message*`, `data/engine/`, `data/local/`, `data/repository/impl/ChatRepositoryImpl.kt`, `di/DatabaseModule.kt`, `test/.../ui/chat/`, `app/schemas/`, `core/common/Outcome.kt`
- Create: `core/common/Either.kt`, `core/common/Unexpected.kt`, `domain/model/ApiErrorCode.kt`, `data/remote/ApiJson.kt`, `data/remote/ApiErrors.kt`, `career-ops-wrapper/contracts/error-codes.json`
- Modify: `core/common/AppError.kt` (replace), `di/RepositoryModule.kt`, `navigation/NavGraph.kt` (start at `SettingsRoute` until Task 6), `ui/settings/SettingsViewModel.kt` and anything else that used `Outcome`, `app/build.gradle.kts` + root `build.gradle.kts` + `gradle/libs.versions.toml` (drop room3, add retrofit, converter-kotlinx-serialization, okhttp, kotlinx-serialization-json; copy versions from `main:android/gradle/libs.versions.toml`), `test/.../architecture/ArchitectureTest.kt`, `career-ops-wrapper/test/contract-examples.test.ts`
- Test: `test/.../core/common/EitherTest.kt`, `test/.../core/common/UnexpectedTest.kt`, `test/.../data/remote/ApiErrorsTest.kt`, `test/.../data/remote/ApiErrorCodeContractTest.kt`

**Interfaces:**
- Produces:
  - `sealed interface Either<out L, out R> { data class Left<out L>(val value: L); data class Right<out R>(val value: R); companion object }`, with `fun <L> L.left()`, `fun <R> R.right()`, and inline `fold(onLeft, onRight)`, `map` (right), `mapLeft`, `flatMap`, `getOrNull()`, `leftOrNull()`.
  - `suspend inline fun <L, R> Either.Companion.catch(onError: (Throwable) -> L, block: () -> R): Either<L, R>`. It has the same shape as the starter's `outcomeOf`: it catches `Exception`, always rethrows `CancellationException`, and wraps the result in `Right`.
  - The convention at every repository and use case boundary is `Either<AppError, T>`.
  - `AppError`:
    ```kotlin
    sealed interface AppError {
        data object Unreachable : AppError
        data object Unauthorized : AppError
        data class Rejected(val code: ApiErrorCode) : AppError
        data class ServerFailure(val status: Int) : AppError
        data object InvalidResponse : AppError
        data object Unknown : AppError
        data class Feature(val reason: FeatureError) : AppError
    }
    interface FeatureError
    ```
    No `Throwable` lives in any `AppError`. `FeatureError` has no implementations yet; the first one arrives with Story 2.5.
  - `enum class ApiErrorCode` mirrors the wrapper's `ErrorCodeSchema`: `VALIDATION_ERROR`, `UNAUTHORIZED`, `WORKSPACE_UNHEALTHY`, `NOT_FOUND`, `SCAN_ALREADY_RUNNING`, `COMMAND_FAILED`, `PARSER_FAILED`, `PATH_OUTSIDE_WORKSPACE`, `PAYLOAD_TOO_LARGE`, `UNEXPECTED_ERROR`, plus `UNKNOWN`. It comes with `fun String?.toApiErrorCode(): ApiErrorCode`.
  - `fun unexpected(t: Throwable, rethrow: Boolean = BuildConfig.DEBUG): AppError`. When `rethrow` is true it throws `t`. Otherwise it logs `t` with `Timber.e` and returns `Unknown`.
  - `fun Throwable.toApiError(): AppError`:
    - `HttpException` 401 → `Unauthorized`.
    - Other `HttpException` 4xx → `Rejected(parsed wrapper code, or UNKNOWN)`.
    - `HttpException` 5xx → `ServerFailure(code())`.
    - `IOException` → `Unreachable`.
    - `SerializationException` → `InvalidResponse`, after logging it.
    - `CancellationException` → rethrown.
    - Anything else → `unexpected(this)`.
  - Repository usage: `Either.catch(onError = Throwable::toApiError) { api.getX() }`.

- [ ] **Step 1: Write the tests.** All of them are plain function calls, with no Retrofit instance.
  - `EitherTest` covers `fold`, `map`, `mapLeft` and `flatMap` on both sides. Its case `catchRethrowsCancellation` is `assertThrows(CancellationException::class.java) { runBlocking { Either.catch(onError = Throwable::toApiError) { throw CancellationException() } } }`.
  - `UnexpectedTest`: with `rethrow = true` it throws; with `rethrow = false` it returns `AppError.Unknown`.
  - `ApiErrorsTest`:
    - `ioExceptionMapsToUnreachable`.
    - `http401MapsToUnauthorized`.
    - `http4xxCarriesWrapperCode`: `HttpException(Response.error<Any>(409, """{"error":{"code":"SCAN_ALREADY_RUNNING","message":"x"}}""".toResponseBody()))` → `Rejected(SCAN_ALREADY_RUNNING)`.
    - `http4xxWithUnparseableBodyIsRejectedUnknown`.
    - `unknownWrapperCodeMapsToUnknownEnum`: code `"FUTURE_CODE"` → `Rejected(UNKNOWN)`.
    - `http5xxMapsToServerFailure`.
    - `serializationExceptionMapsToInvalidResponse`.
    - `unexpectedExceptionIsRethrownInDebug`.
  - `ApiErrorCodeContractTest`: read `../career-ops-wrapper/contracts/error-codes.json` with the same path helper as the contract test, and assert `ApiErrorCode.entries.filter { it != UNKNOWN }.map { it.name }.toSet()` equals that set.
  - Wrapper side: in `contract-examples.test.ts`, assert that `contracts/error-codes.json` deep-equals `ErrorCodeSchema.options`.
  - `ArchitectureTest.exceptionsAreOnlyCaughtAtDataBoundaries`: files outside `core.common`, `data.remote` and `data.local` must not contain `try {`, `catch (` or `runCatching`. It sits next to the starter's existing layer rules.
- [ ] **Step 2: Run them.** Run `./gradlew testDevDebugUnitTest` and `cd ../career-ops-wrapper && npm test`. Expected: Android fails to compile; the wrapper fails on the missing `error-codes.json`.
- [ ] **Step 3: Implement.** Write `error-codes.json` as a sorted JSON array. Read the HTTP error body once with `response()?.errorBody()?.string()` and parse it with `ApiJson`. Until Task 3 brings `ErrorResponseDto`, a private minimal `@Serializable` error-body class in `ApiErrors.kt` stands in for it. Replace every starter use of `Outcome`/`outcomeOf` (settings and DataStore code) with `Either`/`Either.catch`.
- [ ] **Step 4: Verify.** Run `./gradlew testDevDebugUnitTest detekt ktlintCheck` and `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `refactor(android): replace Outcome with Either, add AppError and toApiError`.

### Task 3: Contract DTOs, health domain and the API client

**Files:**
- Create from `main` (moved and repackaged): `data/remote/dto/HealthDto.kt` (from `data/models/HealthDto.kt`), `data/remote/dto/ContractDtos.kt`, `domain/model/Health.kt`
- Create: `data/remote/CareerOpsApi.kt`, `data/remote/PairingTokenInterceptor.kt`, `data/remote/BaseUrl.kt`, `di/NetworkModule.kt`
- Modify: `data/remote/ApiErrors.kt` (use `ErrorResponseDto`)
- Test: `test/.../data/remote/dto/ApiContractCompatibilityTest.kt`, `test/.../data/remote/dto/HealthDtoTest.kt`, `test/.../data/remote/PairingTokenInterceptorTest.kt`, `test/.../data/remote/BaseUrlTest.kt` (ported from `main:android/app/src/test/java/me/dthuy/jobflow/careerops/`)

**Interfaces:**
- Consumes: `ApiJson`, `toApiError` (Task 2).
- Produces:
  - `interface CareerOpsApi { @GET("api/v1/health") suspend fun getHealth(): HealthDto }`
  - `class PairingTokenInterceptor(private val token: () -> String?) : Interceptor`
  - `fun normalizeBaseUrl(raw: String): String` (trims, requires non-blank, appends `/`)
  - `fun HealthDto.toDomain(): Health`
  - `NetworkModule` provides `@Singleton OkHttpClient`, `Retrofit` (base URL `BuildConfig.CAREER_OPS_DEFAULT_BASE_URL`, `ApiJson` converter) and `CareerOpsApi`. The token provider is `{ null }`, with the comment `// Pairing token storage arrives with Epic 7.`
  - Every wire enum in `Health.kt` has an `UNKNOWN("unknown")` entry.

- [ ] **Step 1: Port the tests.** In `ApiContractCompatibilityTest`, replace the local `Json {}` with `ApiJson` (the production instance) and keep the fixture path helper unchanged. Add `unknownWireValuesMapToUnknown`: take `health.ready.json`, set `status` to `"maintenance"` and `workspace.status` to `"future"`, decode, then `toDomain()`, and assert `HealthStatus.UNKNOWN` and `WorkspaceStatus.UNKNOWN`. The interceptor test asserts the header is present for `"abc"`, and absent for `null` and `"  "`. `BaseUrlTest` uses the three cases from the old `JobFlowApiClientTest`.
- [ ] **Step 2: Run them.** Run `./gradlew testDevDebugUnitTest`. Expected: FAIL to compile.
- [ ] **Step 3: Implement.** Move the DTOs and domain model, add `UNKNOWN` entries, and change `toWireEnum` to return the `UNKNOWN` entry instead of calling `error(...)`. Add the API, interceptor, base URL helper and module.
- [ ] **Step 4: Verify.** Run `./gradlew testDevDebugUnitTest detekt ktlintCheck`. Expected: PASS, with all 16 fixtures parsing.
- [ ] **Step 5: Commit** `feat(android): port wrapper contract DTOs and Retrofit client`.

### Task 4: Health repository with wall-clock cache

**Files:**
- Create: `domain/model/HealthSnapshot.kt`, `domain/repository/HealthRepository.kt`, `data/repository/impl/HealthRepositoryImpl.kt`, `di/TimeModule.kt`
- Modify: `di/RepositoryModule.kt`
- Test: `test/.../data/repository/impl/HealthRepositoryImplTest.kt`

**Interfaces:**
- Consumes: `CareerOpsApi`, `Either.catch` + `Throwable::toApiError`, `HealthDto.toDomain()`.
- Produces:
  - `data class HealthSnapshot(val result: Either<AppError, Health>, val checkedAt: java.time.Instant)`
  - `interface HealthRepository { val latest: StateFlow<HealthSnapshot?>; suspend fun refresh(force: Boolean = false): HealthSnapshot }`
  - `@Singleton class HealthRepositoryImpl @Inject constructor(api: CareerOpsApi, clock: Clock) : HealthRepository`, with `companion object { const val FRESHNESS_WINDOW_MILLIS = 3 * 60 * 60 * 1_000L }`
  - `TimeModule` provides `Clock.systemUTC()`.

- [ ] **Step 1: Write the tests** with a fake `CareerOpsApi` (call counter, scripted results) and a mutable test `Clock`:
  - `cachedSuccessIsReusedWithinWindow`: two `refresh()` calls 1h apart → 1 API call.
  - `successExpiresAfterWindow`: second call at 3h + 1ms → 2 calls.
  - `forceBypassesCache` → 2 calls.
  - `failureIsNeverServedFromCache`: the first call throws `IOException`, the second `refresh()` (not forced) calls the API again and returns Success.
  - `latestPublishesEverySnapshot`: `latest.value` equals the last returned snapshot, and `checkedAt` equals `clock.instant()`.
- [ ] **Step 2: Run them.** Expected: FAIL (unresolved).
- [ ] **Step 3: Implement.** Guard refresh with a `Mutex` so concurrent callers share one request.
- [ ] **Step 4: Verify.** Run `./gradlew testDevDebugUnitTest --tests '*HealthRepositoryImplTest'`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(android): add cached health repository`.

### Task 5: Theme, shared components and shared health UI

**Files:**
- Replace: `ui/theme/Theme.kt` (port `main:.../ui/theme/Theme.kt`, rename `MyApplicationTheme` → `AppTheme(darkTheme: Boolean, content)`), `ui/theme/Color.kt` (old Neo tokens plus the soft tokens `JobFlowBackground…JobFlowRed` from `JobFlowShellScreen.kt:421-429`, made public), `ui/theme/Type.kt`. Keep the starter's `Spacing.kt`.
- Create: `ui/components/SoftComponents.kt` (`SoftCard`, `SoftButton`, `SoftBadge`, `SectionLabel`, `DetailRow`, ported from `JobFlowShellScreen.kt`), `ui/components/UiError.kt`, `ui/health/HealthUiState.kt`, `ui/health/HealthUiMapper.kt`, `ui/health/HealthCards.kt` (`HealthSummaryCard`, `HealthDetailsCard`, `GuidanceCard`)
- Modify: `res/values/strings.xml` (all health copy from the old ViewModel and screen, plus the `error_*` strings), `test/.../architecture/ArchitectureTest.kt` (`sharedUiPackages = setOf("theme", "components", "health")`), `libs.versions.toml`/`app/build.gradle.kts` (add `kyantBackdrop` for Task 6)
- Test: `test/.../ui/health/HealthUiMapperTest.kt`, `test/.../ui/components/UiErrorTest.kt`

**Interfaces:**
- Consumes: `HealthSnapshot`, `AppError`, `ApiErrorCode`.
- Produces:
  - `data class UiError(@StringRes val message: Int, val action: ErrorAction)` and `enum class ErrorAction { Retry, Repair, None }`.
  - `fun AppError.toUiError(): UiError`. It is an exhaustive `when` with no `else`:
    - `Unreachable` → `error_unreachable`, `Retry`.
    - `Unauthorized` → `error_pairing_required`, `Repair`.
    - `Rejected` → an exhaustive `when` over `ApiErrorCode`, using strings `error_code_<snake_case>`; most of them have `None`.
    - `ServerFailure` → `error_server`, `Retry`.
    - `InvalidResponse` → `error_incompatible`, `None`.
    - `Unknown` → `error_unexpected`, `Retry`.
    - `Feature` → `error_unexpected`, `Retry`, and logs the unhandled reason. This is the safety net; each feature maps its own sealed `FeatureError` exhaustively in its own screen.
  - One-off messages use the pattern `userMessage: UiError?` in state plus a `onMessageShown()` callback, never a `Channel`. MVI `Effect` stays for navigation only.
  - `enum class HealthUiKind { LOADING, READY, NOT_READY, UNREACHABLE, PAIRING_REQUIRED, INVALID_RESPONSE }`
  - `@Immutable data class HealthUiState(val kind: HealthUiKind = LOADING, val checkedAtLabel: String? = null, val serverTime: String? = null, val workspaceStatus: String? = null, val scannerStatus: String? = null, val guidance: ImmutableList<String> = persistentListOf())`
  - `fun HealthSnapshot?.toHealthUiState(zone: ZoneId = ZoneId.systemDefault()): HealthUiState`. `null` → LOADING. `checkedAtLabel` is the local time formatted `HH:mm`.
  - `@Composable fun HealthUiKind.title(): String` and `fun HealthUiKind.message(): String` via `stringResource`.

- [ ] **Step 1: Write `HealthUiMapperTest`:**
  - `readyHealthMapsToReady`, built from `health.ready.json` via `ApiJson` + `toDomain()`.
  - `notReadyCollectsMissingThenMessagesAsGuidance`, using the ordering from the old `Health.toUiState`.
  - `unreachableMapsToUnreachable`.
  - `unauthorizedMapsToPairingRequired`: `AppError.Unauthorized`.
  - `rejectedServerFailureInvalidAndUnknownMapToInvalidResponse`.
  - `UiErrorTest`: `Unauthorized` → `ErrorAction.Repair`; `Unreachable` and `ServerFailure` → `Retry`; every `ApiErrorCode` entry has a non-zero message resource.
  - `checkedAtIsFormattedInLocalTime`: `Instant.parse("2026-10-30T02:05:00Z")` with `ZoneId.of("Asia/Ho_Chi_Minh")` gives `"09:05"`.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement** the theme, components, mapper and cards. Cards take `HealthUiState` plus callbacks only.
- [ ] **Step 4: Verify.** Run `./gradlew testDevDebugUnitTest detekt ktlintCheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(android): port JobFlow theme, soft components and health UI model`.

### Task 6: Home (MVI), Inputs, Settings and tab navigation

**Files:**
- Create: `ui/home/HomeRoute.kt`, `ui/home/HomeContract.kt`, `ui/home/HomeViewModel.kt`, `ui/home/HomeScreen.kt`, `ui/inputs/InputsRoute.kt`, `ui/inputs/InputsScreen.kt` (three placeholder cards from old `AddPage`, no ViewModel), `navigation/TopLevelTabs.kt`, `navigation/JobFlowBottomNavigation.kt` (ported from `main:.../presentation/component/JobFlowBottomNavigation.kt`)
- Modify: `navigation/NavGraph.kt`, `ui/settings/SettingsViewModel.kt` + `SettingsScreen.kt` (add health details, guidance, Check again; keep the theme picker), `MainActivity.kt` (use `AppTheme`)
- Test: `test/.../ui/home/HomeViewModelTest.kt`, `test/.../ui/settings/SettingsViewModelTest.kt` (extend), `test/.../navigation/TopLevelTabsTest.kt`

**Interfaces:**
- Consumes: `HealthRepository`, `toHealthUiState`, the health cards, the soft components.
- Produces:
  - `HomeState(health: HealthUiState = HealthUiState(), showUnhealthyDialog: Boolean = false, unhealthyDialogConsumed: Boolean = false) : UiState`
  - `HomeIntent { CheckAgain; DismissDialog; OpenHealthDetails; OpenInputs }`
  - `HomeEffect { NavigateToSettings; NavigateToInputs }`
  - `HomeScreen(onOpenSettings: () -> Unit, onOpenInputs: () -> Unit)`, `InputsScreen()`, `SettingsScreen()` (no back callback; it is a tab)
  - `SettingsUiState(themeMode: ThemeMode, health: HealthUiState)`, `SettingsViewModel.onCheckAgain()`
  - `fun topLevelStack(tab: NavKey): List<NavKey>`: `HomeRoute` → `[HomeRoute]`, any other tab → `[HomeRoute, tab]`.

- [ ] **Step 1: Write the tests.** Use a fake `HealthRepository` and `StandardTestDispatcher`/`Dispatchers.setMain`, following the starter's ViewModel test pattern.
  - `initRefreshesWithoutForce`
  - `unhealthyResultShowsDialogOnce`: after dismiss and `CheckAgain` that is still unhealthy, `showUnhealthyDialog` is false.
  - `readyResultNeverShowsDialog`
  - `openHealthDetailsConsumesDialogAndEmitsNavigateToSettings`
  - `checkAgainForcesRefreshAndShowsLoading`
  - `settingsReflectsLatestHealth`
  - `settingsCheckAgainForcesRefresh`
  - `TopLevelTabsTest` covers both cases of `topLevelStack`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** `HomeViewModel extends MviViewModel` and observes `repository.latest` to update `health`. `NavGraph` starts at `HomeRoute` and draws `JobFlowBottomNavigation` with tab selection doing `backStack.clear(); backStack.addAll(topLevelStack(tab))`. Layouts follow the old `HomePage`/`SettingsPage`.
- [ ] **Step 4: Verify.** Run `./gradlew assembleDevDebug testDevDebugUnitTest lintDevDebug detekt ktlintCheck`. Expected: PASS, with Konsist green (no `ui/home` ↔ `ui/settings` imports).
- [ ] **Step 5: Commit** `feat(android): health home, inputs placeholder and tab navigation`.

### Task 7: Docs, agent layer, hooks and CI

**Files:**
- Replace: `android/AGENTS.md` (starter text plus JobFlow facts: flavors, verify command, wrapper boundary, "Read `../AGENTS.md` for workspace rules"), `android/README.md`
- Modify: `android/docs/codebase-summary.md` (package map must name every top-level package: `core`, `data`, `di`, `domain`, `navigation`, `ui`), `android/docs/system-architecture.md` (replace the chat sequence with a health refresh sequence and add a "Network" section), `android/docs/module-guides.md` (remove the chat engine recipe and add "add an API endpoint"), `android/.claude/skills/**` (remove chat references; rewrite `references/data-and-errors.md` for `Either<AppError, T>`, the two mapping boundaries and `FeatureError`), `android/docs/decisions/0003-return-outcome-for-expected-failures.md` (status: "Superseded by 0010"), `.githooks/pre-commit` (`./android/gradlew -p android ktlintCheck detekt`), root `AGENTS.md`, `README.md` (replace `./gradlew installGitHooks`/`qualityCheck` with `git config core.hooksPath .githooks` and the canonical verify command), `docs/codebase-summary.md`, `docs/system-architecture.md`, `docs/design-guidelines.md` (point to `ui/components`/`ui/theme`)
- Create: `android/docs/decisions/0008-rebuild-jobflow-android-from-starter.md` (D1–D10 condensed), `android/docs/decisions/0009-retrofit-kotlinx-serialization-network-layer.md`, `android/docs/decisions/0010-use-either-and-two-boundary-error-mapping.md` (D5, including the rejected options: `Outcome` name, `apiCall` wrapper, Retrofit `CallAdapter`, per-operation `Either<E, T>` everywhere, and `FeatureError.toUiError()` in domain because it would make `domain/` depend on string resources), `.github/workflows/android.yml`, `.github/workflows/wrapper.yml`
- Delete: `android/scripts/install-git-hooks.sh`, `android/scripts/git-hooks/` (root hook is used)

- [ ] **Step 1: Run `DocsTest` first.** Run `./gradlew testDevDebugUnitTest --tests '*DocsTest'`. It is the failing test for this task: it reports stale paths and links.
- [ ] **Step 2: Update the docs** until `DocsTest` passes. The verify command must appear byte-identical everywhere it is written.
- [ ] **Step 3: Write CI.** `android.yml` copies the starter's `ci.yml` `verify` and `agent-layer` jobs, with `defaults.run.working-directory: android`, flavor-qualified tasks, and triggers on `paths: ['android/**', 'career-ops-wrapper/contracts/**', '.github/workflows/android.yml']` (fixtures drive Android tests). `wrapper.yml` runs `npm ci && npm test && npm run build` in `career-ops-wrapper` on Node from `career-ops-wrapper/package.json` `engines` (or 22 if absent).
- [ ] **Step 4: Verify.** Run `cd android && python3 -m unittest discover -s tools/agents -t tools/agents && ./gradlew assembleDevDebug testDevDebugUnitTest lintDevDebug detekt ktlintCheck`, then `cd ../career-ops-wrapper && npm test`. Expected: all PASS.
- [ ] **Step 5: Commit** `docs(android): adopt starter docs, ADRs and CI for JobFlow`.

### Task 8: End-to-end verification

**Files:** none (fix forward in the owning task's files if anything fails)

- [ ] **Step 1: Run the full gate.** Run the canonical verify command plus `./gradlew assembleProdRelease`. Expected: BUILD SUCCESSFUL. An unsigned release is fine.
- [ ] **Step 2: Live check on the emulator.** Start the wrapper with `npm run dev -- --workspace <career-ops path>`, then install devDebug. Check, with a screenshot each: Home shows Ready; stop the wrapper and Check again shows Unreachable plus the dialog once; restart the wrapper and Check again shows Ready; Settings shows "Last checked HH:mm" in local time; tab switches keep Home state.
- [ ] **Step 3: R8 smoke test.** Build `devRelease` signed with the debug keystore (`-Pandroid.injected.signing.*` or a temporary local signing env), install it, and confirm health loads. If JSON parsing fails, add keep rules to `proguard-rules.pro` for `me.dthuy.jobflow.data.remote.dto.**` and retest.
- [ ] **Step 4: Report** the changed files, checks run and screenshots. Do not merge or push without the user.
