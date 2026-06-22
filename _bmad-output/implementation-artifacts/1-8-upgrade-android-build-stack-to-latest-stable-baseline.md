---
created: 2026-06-22
story_key: 1-8-upgrade-android-build-stack-to-latest-stable-baseline
owner: Hy
baseline_commit: 95bcb21
---

# Story 1.8: Upgrade Android Build Stack to Latest Stable Baseline

Status: done

Owner: Hy

<!-- Supplemental foundation story created after dependency/version research and Ponytail audit. -->

## Story

As a mobile developer maintaining the Career Ops Mobile foundation,
I want the existing Android project upgraded to the latest stable build stack and stripped of unused third-party dependencies,
so that later Career Ops Android stories start from a modern, clean, and reproducible baseline.

## Acceptance Criteria

1. Given the Android project build files are inspected, when this story is complete, then the Gradle Wrapper uses `9.6.0`, Android Gradle Plugin uses `9.2.1`, Kotlin and Compose compiler plugin use `2.4.0`, and Compose artifacts are governed by Compose BOM `2026.06.00`.
2. Given SDK 37 is installed locally, when the Android app builds, then `compileSdk` and `targetSdk` use `37` and `minSdk` remains `24`. If SDK 37 cannot be used in the local environment, the implementation must document the blocker and keep the highest working installed SDK without silently claiming SDK 37 support.
3. Given active Android libraries are declared in `gradle/libs.versions.toml`, when dependency versions are updated, then active latest-stable targets are Room `2.8.4`, Retrofit `3.0.0`, OkHttp `5.4.0`, Moshi `1.15.2`, Coroutines `1.11.0`, Robolectric `4.16.1`, Roborazzi `1.64.0` only if retained, AndroidX Core KTX `1.19.0`, Activity Compose `1.13.0`, Lifecycle `2.11.0`, AndroidX Test Core/Runner `1.7.0`, AndroidX JUnit `1.3.0`, and Espresso `3.7.0`.
4. Given a dependency/plugin/catalog entry is not used by current source or this story, when cleanup is complete, then Firebase BOM/Firebase AI, Secrets Gradle Plugin, OkHttp logging-interceptor, commented future dependencies, and unused version-catalog aliases are removed where safe.
5. Given the old Android scaffold contains direct Gemini API code, when cleanup is complete, then direct Gemini network/API-key integration is removed from the Android app and no `GEMINI_API_KEY` BuildConfig path remains. Existing Task Arena UI must still compile and run; if the roast flow remains visible, it must use a local deterministic fallback instead of a network provider call.
6. Given this is a foundation cleanup story, when implementation is reviewed, then no Career Ops feature UI, wrapper connection UI, product flavors, Room projection entities, Career Ops Retrofit DTOs, or scan/offers functionality are implemented in this story.
7. Given validation is run, when the story is complete, then Android unit tests pass with `./gradlew test`, the app assembles with `./gradlew assembleDebug` if local SDK/tooling allows, and backend validations that previously passed are not broken by incidental edits.

## Tasks / Subtasks

- [x] Upgrade Gradle wrapper and Android build toolchain. (AC: 1, 2)
  - [x] Run or reproduce `./gradlew wrapper --gradle-version 9.6.0 --distribution-type bin` so `gradle/wrapper/gradle-wrapper.properties` and wrapper metadata are updated consistently.
  - [x] Update `gradle/libs.versions.toml` plugin versions: AGP `9.2.1`, Kotlin `2.4.0`, Compose plugin `2.4.0`, KSP `2.3.9`.
  - [x] Set `compileSdk`/`targetSdk` to `37` when available; keep `minSdk = 24`.
  - [x] Preserve the existing Android app module and package namespace; do not create a new starter project.

- [x] Upgrade active Android library versions. (AC: 3)
  - [x] Update Compose BOM to `2026.06.00`.
  - [x] Update active AndroidX/Square/Kotlin libraries to the target versions in the acceptance criteria.
  - [x] Keep Compose artifacts unversioned and governed by the BOM.
  - [x] Keep Room and Moshi KSP/codegen aligned with Kotlin/KSP upgrades.

- [x] Remove unused third-party dependencies and plugins. (AC: 4, 5)
  - [x] Remove Firebase BOM and Firebase AI catalog entries because Firebase is non-MVP and unused.
  - [x] Remove Secrets Gradle Plugin and its `secrets {}` block after removing `BuildConfig.GEMINI_API_KEY` usage.
  - [x] Remove direct OkHttp logging-interceptor dependency because no `HttpLoggingInterceptor` is imported.
  - [x] Remove commented-out future dependency declarations from `app/build.gradle.kts`.
  - [x] Remove unused catalog entries for deferred features such as Camera, Coil, DataStore, Location, Accompanist permissions, Navigation, and Firebase unless current source proves they are active.

- [x] Remove direct Gemini API path without breaking the old Task Arena screen. (AC: 5, 6)
  - [x] Delete or retire `app/src/main/java/com/example/data/api/GeminiApiService.kt`.
  - [x] Remove Gemini request/response DTO imports and Retrofit client usage from `TaskRepositoryImpl`.
  - [x] Preserve the existing `TaskRepository`/`RoastTaskUseCase`/`ArenaViewModel` compile path, or intentionally simplify it, so creating tasks and tapping roast still does not crash.
  - [x] If a visible roast action remains, return a local fallback message instead of calling any provider API.
  - [x] Do not add Firebase AI, Gemini SDK, OpenAI SDK, Career Ops AI provider mode, or wrapper API calls in this story.

- [x] Trim sample-only test stack where safe. (AC: 4, 7)
  - [x] Remove `GreetingScreenshotTest` and Roborazzi dependencies if there are no real UI baseline screenshots to preserve.
  - [x] Remove sample `ExampleInstrumentedTest` dependencies if there are no real Android instrumented tests yet.
  - [x] Keep useful unit/Robolectric tests only if they validate real app behavior after dependency cleanup.
  - [x] Update any retained Robolectric SDK config to match the chosen compile SDK where needed.

- [x] Validate and document any unavoidable fallback. (AC: 1-7)
  - [x] Run `./gradlew test`.
  - [x] Run `./gradlew assembleDebug` when local SDK/tooling supports the chosen compile SDK.
  - [x] If Gradle `9.6.0` fails due to a real unresolved AGP/tooling conflict, document the exact error and fall back only to AGP's documented Gradle `9.4.1`.
  - [x] If SDK 37 is unavailable and cannot be installed during implementation, document that environment blocker in completion notes.

### Review Findings

- [x] [Review][Patch] Remove orphaned sample screenshot artifact after deleting Roborazzi test stack [`app/src/test/screenshots/greeting.png`:1]
- [x] [Review][Patch] Remove trailing whitespace that makes `git diff --check` fail [`gradlew.bat`:76]

## Dev Notes

### Scope Boundary

This is an Android build and dependency foundation story only. It must not implement Career Ops product flows. Story 1.4 still owns dev/prod flavors and wrapper connection settings. Story 1.5 still owns setup/health UI. Later stories own Career Ops DTOs, repositories, Room projection entities, scan polling, offers, reports, and navigation.

### Current Android State to Modify

The current repo state before this story:

- `gradle/wrapper/gradle-wrapper.properties` points to Gradle `9.3.1`.
- `gradle/libs.versions.toml` declares AGP `9.1.1`, Kotlin `2.2.10`, Compose BOM `2024.09.00`, Room `2.7.0`, Retrofit `2.12.0`, OkHttp `4.10.0`, Coroutines `1.10.2`, Roborazzi `1.59.0`, Firebase BOM `34.12.0`, and Secrets Gradle Plugin `2.0.1`.
- `app/build.gradle.kts` applies Android application, Kotlin Compose, KSP, Roborazzi, and Secrets plugins.
- `app/build.gradle.kts` actively includes Firebase BOM and logging-interceptor even though current source does not use Firebase or `HttpLoggingInterceptor`.
- `app/build.gradle.kts` contains many commented-out future dependencies; do not keep them as a shopping list.
- `app/src/main/java/com/example/data/api/GeminiApiService.kt` implements a direct Gemini REST client.
- `TaskRepositoryImpl.getAiRealityCheck()` reads `BuildConfig.GEMINI_API_KEY` and calls the Gemini client.

### Required Version Targets

Use latest stable versions verified on 2026-06-22:

| Area | Target |
| --- | --- |
| Gradle Wrapper | `9.6.0` |
| Android Gradle Plugin | `9.2.1` |
| Kotlin / Compose plugin | `2.4.0` |
| KSP | `2.3.9` |
| compileSdk / targetSdk | `37` if installed |
| minSdk | `24` |
| Compose BOM | `2026.06.00` |
| AndroidX Core KTX | `1.19.0` |
| Activity Compose | `1.13.0` |
| Lifecycle Runtime/ViewModel/Compose | `2.11.0` |
| Room Runtime/KTX/Compiler | `2.8.4` |
| Coroutines Android/Core/Test | `1.11.0` |
| Retrofit / converter-moshi | `3.0.0` |
| OkHttp | `5.4.0` |
| Moshi Kotlin / Codegen | `1.15.2` |
| Robolectric | `4.16.1` |
| Roborazzi | `1.64.0` only if retained |
| AndroidX Test Core/Runner | `1.7.0` |
| AndroidX JUnit | `1.3.0` |
| Espresso | `3.7.0` |

Do not use alpha/preview versions unless the user explicitly requests them. Examples to avoid by default: AGP `9.4.0-alpha01`, Navigation `2.10.0-alpha05`, Room `3.0.0-alpha*`.

### Dependency Removal Guidance

Prefer deletion over version bumping for unused dependencies:

- Remove Firebase entries because MVP has no Firebase/App Check/auth/cloud backend.
- Remove Secrets Gradle Plugin because Career Ops MVP should not use direct Gemini API keys in Android.
- Remove OkHttp logging-interceptor because no logging interceptor is wired.
- Remove deferred catalog aliases for features not implemented yet; future stories should add dependencies when they are actually needed.
- Remove Roborazzi only if no real screenshot baseline remains after deleting sample screenshot tests.
- Keep Room, Retrofit, OkHttp, Moshi, Coroutines, Compose, and Lifecycle because current or near-term Career Ops architecture depends on them.

### Existing Behavior to Preserve

The current Task Arena screen should still compile and basic task CRUD should continue to work. Removing Gemini must not leave dangling imports, missing `BuildConfig.GEMINI_API_KEY`, or a broken `RoastTaskUseCase` path.

Acceptable temporary result:

- `getAiRealityCheck()` returns a local deterministic fallback string; or
- the roast action is simplified locally while preserving app compile/run.

Not acceptable:

- adding another AI provider SDK;
- moving Gemini logic to Firebase AI;
- starting Career Ops wrapper integration early;
- deleting broad Task Arena UI code just to make dependencies disappear.

### Project Structure Notes

Expected files to update or delete:

```text
gradle/wrapper/gradle-wrapper.properties
gradle/wrapper/gradle-wrapper.jar
gradle/libs.versions.toml
app/build.gradle.kts
app/src/main/java/com/example/data/api/GeminiApiService.kt
app/src/main/java/com/example/data/repository/TaskRepositoryImpl.kt
app/src/test/java/com/example/GreetingScreenshotTest.kt
app/src/androidTest/java/com/example/ExampleInstrumentedTest.kt
```

Do not create:

```text
app/src/main/java/com/example/careerops/
app/src/dev/
app/src/prod/
career-ops-wrapper changes
docs/career-ops-mobile/evidence changes
```

unless validation reveals a small documentation note is needed for an unavoidable toolchain fallback.

### Previous Story Intelligence

Story 1.7 completed backend OpenAPI/docs work and validated with:

- `cd career-ops-wrapper && npm test`
- `cd career-ops-wrapper && npm run build`
- `./gradlew test`

This story is Android-only, but it should not regress backend artifacts or existing wrapper code. Keep unrelated backend changes out of scope.

Recent git history includes backend foundation work and older Android neo-brutalist decomposition. Existing Android UI style should be preserved; this story is not a redesign.

### Testing Requirements

Minimum validation:

```bash
./gradlew test
./gradlew assembleDebug
```

If `assembleDebug` cannot run because Android SDK 37 is not installed, capture the exact error and either install SDK 37 locally or document the fallback. Do not mark SDK 37 complete without a build proving it.

Optional backend smoke validation if dependency cleanup touches repo-level Gradle only:

```bash
cd career-ops-wrapper && npm test
cd career-ops-wrapper && npm run build
```

### Latest Technical Notes

- Gradle version service reports Gradle `9.6.0` as current/final stable on 2026-06-22.
- Google Maven metadata reports latest stable AGP `9.2.1`; newer AGP `9.4.0-alpha01` is preview and not the default baseline.
- Kotlin release docs list Kotlin `2.4.0` as the latest stable release line.
- Compose BOM mapping lists BOM `2026.06.00`.
- Maven/Google metadata reports Room `2.8.4`, Retrofit `3.0.0`, OkHttp `5.4.0`, Coroutines `1.11.0`, AndroidX Core KTX `1.19.0`, Activity Compose `1.13.0`, Lifecycle `2.11.0`, AndroidX Test Core/Runner `1.7.0`, AndroidX JUnit `1.3.0`, and Espresso `3.7.0`.

## References

- [Project Context Technology Stack](/Users/dthuy/Workspace/task-arena/_bmad-output/project-context.md)
- [Stack Version Baseline Research](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/research/technical-career-ops-mobile-stack-version-baseline-research-2026-06-22.md)
- [Epic 1 Android Connection Story](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/epics.md)
- [Architecture Project Structure](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md)

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `./gradlew wrapper --gradle-version 9.6.0 --distribution-type bin` initially failed because the existing wrapper config used `distributionSha256Sum`; rerun succeeded with official Gradle 9.6.0 SHA256.
- `sdkmanager "platforms;android-37.0" "build-tools;37.0.0"` installed SDK 37 locally before switching `compileSdk`/`targetSdk`.
- First `./gradlew test` after SDK 37 upgrade failed because Robolectric 4.16.1 reported SDK 37 as unknown. The app remains compile/target SDK 37; the retained Robolectric sample test now runs with SDK 36, matching current Robolectric support.
- `./gradlew assembleDebug --warning-mode all` completed successfully with configuration cache reuse and no displayed deprecation details.
- Code review patch validation: removed stale sample screenshot artifact and fixed `gradlew.bat` trailing whitespace; `git diff --check`, `./gradlew test`, and `./gradlew assembleDebug` passed afterward.

### Completion Notes List

- Story created by BMAD create-story workflow as a supplemental Android foundation story before Story 1.4.
- Upgraded Android build baseline to Gradle Wrapper 9.6.0, AGP 9.2.1, Kotlin/Compose plugin 2.4.0, Compose BOM 2026.06.00, compileSdk/targetSdk 37, and active latest-stable library versions.
- Installed Android SDK Platform 37.0 and Build Tools 37.0.0 locally via SDK Manager to avoid an SDK fallback.
- Removed unused Firebase, Secrets Gradle Plugin, OkHttp logging-interceptor, Roborazzi, sample instrumentation, sample screenshot, and commented future dependency declarations.
- Removed direct Gemini REST/API-key path from Android and replaced the old roast network call with a deterministic local fallback so the existing Task Arena flow still compiles.
- Validation passed: `./gradlew test`, `./gradlew assembleDebug`, `cd career-ops-wrapper && npm test`, and `cd career-ops-wrapper && npm run build`.
- Code review completed with 2 patch findings applied and revalidated.

### Change Log

- 2026-06-22: Upgraded Android toolchain/dependencies, removed unused provider/test dependencies, removed direct Gemini API path, and validated Android/backend builds.
- 2026-06-22: Applied code review cleanup for stale screenshot artifact and wrapper batch whitespace.

### File List

- `build.gradle.kts`
- `gradle/libs.versions.toml`
- `gradle/wrapper/gradle-wrapper.properties`
- `gradle/wrapper/gradle-wrapper.jar`
- `gradlew`
- `gradlew.bat`
- `app/build.gradle.kts`
- `app/src/main/java/com/example/data/api/GeminiApiService.kt` (deleted)
- `app/src/main/java/com/example/data/database/AppDatabase.kt`
- `app/src/main/java/com/example/data/repository/TaskRepositoryImpl.kt`
- `app/src/test/java/com/example/ExampleRobolectricTest.kt`
- `app/src/test/java/com/example/GreetingScreenshotTest.kt` (deleted)
- `app/src/test/screenshots/greeting.png` (deleted)
- `app/src/androidTest/java/com/example/ExampleInstrumentedTest.kt` (deleted)
- `_bmad-output/implementation-artifacts/1-8-upgrade-android-build-stack-to-latest-stable-baseline.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
