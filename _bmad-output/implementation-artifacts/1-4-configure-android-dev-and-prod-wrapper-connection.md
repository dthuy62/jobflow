---
created: 2026-06-22
story_key: 1-4-configure-android-dev-and-prod-wrapper-connection
owner: Hy
baseline_commit: 55ef27f
---

# Story 1.4: Configure Android Dev and Prod Wrapper Connection

Status: complete

Owner: Hy

<!-- Android-owned foundation story. Codex is mentor/fallback executor if Hy requests help during implementation. -->

## Story

As a personal mobile app user,
I want the Android app to have simple dev and prod connection behavior,
so that I can use the app on emulator or a personal device without managing complex connection profiles.

## Acceptance Criteria

1. Given the Android project is built, when product flavors are inspected, then the app defines exactly two MVP flavors: `dev` and `prod`, and `dev` uses application ID suffix `.dev`, app name `[DEV] JobFlow`, and default wrapper URL `http://10.0.2.2:3000`.
2. Given the `prod` flavor is built during current development, when connection defaults are inspected, then `prod` has no application ID suffix, app name `JobFlow`, and temporarily uses the same local wrapper URL as `dev` (`http://10.0.2.2:3000`) until release-ready prod config is needed.
3. Given the app runs in `dev` flavor, when it connects to the local Wrapper Backend from an Android emulator, then it can use cleartext HTTP for the configured local development URL, and the network security configuration is limited to dev/local development needs.
4. Given the app starts, when the Career Ops API client is created, then it uses the flavor-provided wrapper base URL and optional session Local Pairing Token as connection config without creating endpoint lists, workspace path fields, connection-profile registries, or settings persistence.
5. Given an API request is sent from Android, when a Local Pairing Token is configured for the session, then the Retrofit/OkHttp client attaches `X-Career-Ops-Token: <token>`, and if no token is configured, the client omits the header rather than sending an empty token.
6. Given backend API code is inspected, when the JobFlow remote foundation is reviewed, then one shared Retrofit/OkHttp client configuration exists for the wrapper API without endpoint lists, settings persistence, or dynamic client recreation in this story.
7. Given Android validation runs, when this story is complete, then `./gradlew test`, `./gradlew assembleDevDebug`, and `./gradlew assembleProdDebug` pass.

## Tasks / Subtasks

- [x] Add Android `dev` and `prod` product flavors. (AC: 1, 2, 7)
  - [x] Add a single flavor dimension such as `environment`.
  - [x] Define exactly two product flavors: `dev` and `prod`.
  - [x] Configure `dev` with `applicationIdSuffix = ".dev"`.
  - [x] Configure `prod` with no suffix.
  - [x] Add flavor-specific `BuildConfig` values for wrapper defaults: `CAREER_OPS_DEFAULT_BASE_URL` and any simple flavor marker such as `CAREER_OPS_ENVIRONMENT`.
  - [x] Do not add `staging`, `qa`, endpoint-list variants, or connection-profile registry.

- [x] Configure app labels through flavor resources or manifest placeholders. (AC: 1, 2)
  - [x] Keep the manifest using `@string/app_name`.
  - [x] Provide `app/src/dev/res/values/strings.xml` with `[DEV] JobFlow`.
  - [x] Provide `app/src/prod/res/values/strings.xml` with `JobFlow`.
  - [x] Preserve existing launcher/activity behavior and do not redesign the current JobFlow UI in this story.

- [x] Add dev-only local cleartext network security. (AC: 3)
  - [x] Add a `dev` network security config that permits cleartext only for emulator/local development hosts required by MVP, especially `10.0.2.2`.
  - [x] Wire the dev flavor manifest to use the dev network security config.
  - [x] Ensure prod does not inherit broad cleartext permission.
  - [x] Do not set global app-wide cleartext for all domains.

- [x] Add shared Retrofit/OkHttp wrapper API foundation. (AC: 4, 5, 6)
  - [x] Create `JobFlowAuthInterceptor` under `app/src/main/java/me/dthuy/jobflow/data/remote/`.
  - [x] Attach `X-Career-Ops-Token` only when the session token is non-null and non-blank after trimming.
  - [x] Create `JobFlowApiClient` under `app/src/main/java/me/dthuy/jobflow/data/remote/` to build one Retrofit instance with shared OkHttp config.
  - [x] Create `JobFlowApiService` under `app/src/main/java/me/dthuy/jobflow/data/remote/` as the typed wrapper API surface for later endpoint stories.
  - [x] Use `BuildConfig.CAREER_OPS_DEFAULT_BASE_URL` as the flavor-provided base URL input when wiring the client.
  - [x] Do not add SharedPreferences, DataStore, endpoint lists, dynamic client providers, or runtime client recreation in this story.

- [x] Add focused unit tests. (AC: 1-7)
  - [x] Test `JobFlowAuthInterceptor` attaches the header with a token and omits it without a token.
  - [x] Test `JobFlowApiClient` can create a Retrofit service from a valid base URL and normalize a missing trailing slash.
  - [x] Keep tests under `app/src/test/java/me/dthuy/jobflow/careerops/`.

- [x] Validate the Android build variants. (AC: 7)
  - [x] Run `./gradlew test`.
  - [x] Run `./gradlew assembleDevDebug`.
  - [x] Run `./gradlew assembleProdDebug`.
  - [x] If the exact variant task names differ after flavor creation, document the actual task names in the Dev Agent Record and run the equivalent dev/prod debug builds.

### Review Findings

- [x] [Review][Decision] Decide prod wrapper base URL/client lifecycle — resolved for development by setting `prod` `CAREER_OPS_DEFAULT_BASE_URL` to the same local wrapper URL as `dev` (`http://10.0.2.2:3000`).
- [x] [Review][Patch] Normalize Retrofit base URL before building the client [android/app/src/main/java/me/dthuy/jobflow/data/remote/JobFlowApiClient.kt:12]
- [x] [Review][Patch] Add API client construction coverage for the flavor-provided dev URL [android/app/src/main/java/me/dthuy/jobflow/data/remote/JobFlowApiClient.kt:8]

## Dev Notes

### Scope Boundary

This story configures Android connection foundations only. It must not implement the setup/health screen from Story 1.5, CV/Profile/Portal APIs, scan start/polling, Room projection entities, offer/report screens, or any Career Ops Workspace file access.

Backend code is out of scope unless a contract/example reference is needed for tests. The wrapper already exposes `/api/v1/health` and OpenAPI/docs from previous backend stories.

### Current Android State

Story 1.8 left the Android app on the upgraded build baseline:

- Gradle Wrapper `9.6.0`
- Android Gradle Plugin `9.2.1`
- Kotlin/Compose plugin `2.4.0`
- Compose BOM `2026.06.00`
- `compileSdk` and `targetSdk` `37`
- `minSdk` `24`
- Room `2.8.4`, Retrofit `3.0.0`, OkHttp `5.4.0`, Moshi `1.15.2`, Coroutines `1.11.0`, Robolectric `4.16.1`

Current `app/build.gradle.kts` already has `dev` and `prod` product flavors, BuildConfig fields, and `buildFeatures.buildConfig = true`. Network security and flavor resources may already exist from partial 1.4 work; implementation must inspect current files before adding or moving anything.

Current package/namespace facts:

- Gradle namespace: `me.dthuy.jobflow`
- Application ID: `me.dthuy.jobflow`
- Current app label resource: `app/src/main/res/values/strings.xml` has `JobFlow`
- Existing source package: `app/src/main/java/me/dthuy/jobflow`

### Architecture Requirements

- Android must use exactly two MVP product flavors: `dev` and `prod`.
- `dev` defaults to emulator wrapper URL `http://10.0.2.2:3000`.
- `prod` temporarily defaults to the same local wrapper URL as `dev` during current development. This story does not implement runtime wrapper endpoint editing.
- Wrapper base URL and Local Pairing Token are connection/session configuration for this story, not user-edited Career Ops content.
- Do not create a saved endpoint list, workspace path field, or connection-profile registry.
- Do not add SharedPreferences/DataStore persistence for wrapper connection in this story.
- Android never sees or stores the Career Ops Workspace path.
- LAN access uses the `X-Career-Ops-Token` header.
- CORS is not relevant because Android uses Retrofit/OkHttp, not a browser.
- User-editable Career Ops inputs are CV, Profile, and Portals in later epics; do not confuse those with wrapper connection config.

### File Structure Requirements

Expected files to update:

```text
app/build.gradle.kts
app/src/main/AndroidManifest.xml
```

Expected files to create:

```text
app/src/dev/AndroidManifest.xml
app/src/dev/res/values/strings.xml
app/src/dev/res/xml/network_security_config.xml
app/src/prod/res/values/strings.xml
app/src/main/java/me/dthuy/jobflow/data/remote/JobFlowAuthInterceptor.kt
app/src/main/java/me/dthuy/jobflow/data/remote/JobFlowApiClient.kt
app/src/main/java/me/dthuy/jobflow/data/remote/JobFlowApiService.kt
app/src/test/java/me/dthuy/jobflow/careerops/
```

The exact dev manifest strategy may vary. Prefer a small flavor manifest that only adds `android:networkSecurityConfig="@xml/network_security_config"` for dev. Avoid changing the base manifest in a way that grants cleartext to prod.

Do not create:

```text
app/src/staging/
app/src/qa/
app/src/main/java/me/dthuy/jobflow/careerops/presentation/setup/
app/src/main/java/me/dthuy/jobflow/careerops/data/local/
app/src/main/java/me/dthuy/jobflow/careerops/data/database/
career-ops-wrapper changes
```

### Implementation Guidance

Recommended Gradle Kotlin DSL shape:

```kotlin
flavorDimensions += "environment"

productFlavors {
    create("dev") {
        dimension = "environment"
        applicationIdSuffix = ".dev"
        buildConfigField("String", "CAREER_OPS_ENVIRONMENT", "\"dev\"")
        buildConfigField("String", "CAREER_OPS_DEFAULT_BASE_URL", "\"http://10.0.2.2:3000\"")
    }
    create("prod") {
        dimension = "environment"
        buildConfigField("String", "CAREER_OPS_ENVIRONMENT", "\"prod\"")
        buildConfigField("String", "CAREER_OPS_DEFAULT_BASE_URL", "\"http://10.0.2.2:3000\"")
    }
}
```

Use the existing Retrofit and OkHttp dependencies. Retrofit owns typed API interfaces and Moshi conversion. OkHttp owns transport config and interceptors. Do not add another networking dependency.

`JobFlowApiClient` should be a small shared builder, not a dependency-injection framework. Create the Retrofit service from the flavor-provided base URL and optional session token at the composition root when it is first needed.

Interceptor behavior should be deterministic:

```kotlin
val token = pairingToken?.trim()
if (!token.isNullOrEmpty()) {
    requestBuilder.header("X-Career-Ops-Token", token)
}
```

Never send `X-Career-Ops-Token` with an empty string.

Do not add `WrapperConnectionSettingsLocalDataSource`, SharedPreferences, DataStore, endpoint registries, client caches, or dynamic client recreation. Those are not required for the 1.4 foundation.

### Network Security Guidance

Android official docs confirm that Android Emulator uses `10.0.2.2` as the special alias for the host machine loopback interface. Use that for the dev default wrapper URL.

Android official network security config docs warn against broad cleartext. Keep cleartext constrained to dev/local network needs. A dev-only config may permit:

```xml
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">10.0.2.2</domain>
        <domain includeSubdomains="false">localhost</domain>
    </domain-config>
</network-security-config>
```

If Android tooling rejects IP addresses in `domain-config`, use the smallest accepted dev-only alternative and document the trade-off in the Dev Agent Record. Do not silently enable prod-wide cleartext.

### Previous Story Intelligence

- Story 1.3 health contract includes `health.ready.json` and `health.not-ready.json`. A later story will call `GET /api/v1/health`; this story only prepares flavor config and the shared Retrofit/OkHttp client path.
- Story 1.7 exposed OpenAPI/docs for the wrapper. Do not add duplicate API documentation from Android.
- Story 1.8 removed Firebase, Secrets Gradle Plugin, logging-interceptor, Roborazzi, direct Gemini API code, and unused deferred dependencies. Do not reintroduce them.
- Story 1.8 explicitly left product flavors for Story 1.4. This story should now create the flavors and Career Ops package foundation.
- Current Robolectric test uses SDK 36 because Robolectric `4.16.1` does not support SDK 37 runtime yet. Keep that workaround unless a newer supported Robolectric version is intentionally adopted in another story.

### Testing Requirements

Minimum validation:

```bash
./gradlew test
./gradlew assembleDevDebug
./gradlew assembleProdDebug
```

Suggested focused tests:

- `JobFlowAuthInterceptorTest`
- `JobFlowApiClientTest` only if `JobFlowApiClient` contains logic beyond direct Retrofit construction.

For interceptor tests, use OkHttp primitives directly where practical. Do not add `mockwebserver` unless the test genuinely needs it; this story can verify header behavior with an interceptor chain fake or a lightweight request assertion.

### References

- [Epics Story 1.4](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/epics.md:281)
- [Architecture Android Environment Configuration](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md:1062)
- [Architecture File Organization Patterns](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md:1228)
- [Architecture Development Workflow Integration](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md:1256)
- [PRD MVP Connection Modes](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/prd.md:171)
- [Story 1.8 Android Baseline](/Users/dthuy/Workspace/task-arena/_bmad-output/implementation-artifacts/1-8-upgrade-android-build-stack-to-latest-stable-baseline.md:1)
- [Android Build Variants](https://developer.android.com/build/build-variants)
- [Android Network Security Configuration](https://developer.android.com/privacy-and-security/security-config)
- [Android Emulator Networking](https://developer.android.com/studio/run/emulator-networking-address)

## Change Log

- 2026-06-22: Created Story 1.4 with Android dev/prod flavor, wrapper connection settings, Local Pairing Token interceptor, and validation guidance.
- 2026-06-24: Narrowed Story 1.4 to minimal flavor/network/client foundation; removed local settings persistence and runtime wrapper connection editing from this story.
- 2026-06-24: Closed Story 1.4 after setting temporary development prod URL, normalizing Retrofit base URL, adding client coverage, and validating dev/prod builds.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `./gradlew testDevDebugUnitTest --tests 'me.dthuy.jobflow.careerops.JobFlowApiClientTest'`
- `./gradlew testProdDebugUnitTest --tests 'me.dthuy.jobflow.careerops.JobFlowApiClientTest'`
- `./gradlew test`
- `./gradlew assembleDevDebug assembleProdDebug`

### Completion Notes List

- Configured `dev` and `prod` flavors with shared temporary local wrapper URL for development.
- Added dev-only network security config for emulator/local cleartext hosts.
- Added shared Retrofit/OkHttp wrapper client, typed API service, and auth interceptor.
- Added focused interceptor and API client unit tests.
- Validation passed for unit tests and dev/prod debug assemblies.

### File List

- `android/android-app-config.json`
- `android/app/build.gradle.kts`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/src/dev/AndroidManifest.xml`
- `android/app/src/dev/res/values/strings.xml`
- `android/app/src/dev/res/xml/network_security_config.xml`
- `android/app/src/prod/res/values/strings.xml`
- `android/app/src/main/java/me/dthuy/jobflow/AppContainer.kt`
- `android/app/src/main/java/me/dthuy/jobflow/JobFlowApplication.kt`
- `android/app/src/main/java/me/dthuy/jobflow/data/remote/JobFlowApiClient.kt`
- `android/app/src/main/java/me/dthuy/jobflow/data/remote/JobFlowApiService.kt`
- `android/app/src/main/java/me/dthuy/jobflow/data/remote/JobFlowAuthInterceptor.kt`
- `android/app/src/test/java/me/dthuy/jobflow/careerops/JobFlowApiClientTest.kt`
- `android/app/src/test/java/me/dthuy/jobflow/careerops/JobFlowAuthInterceptorTest.kt`
