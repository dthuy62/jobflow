---
created: 2026-06-22
story_key: 1-4-configure-android-dev-and-prod-wrapper-connection
owner: Hy
baseline_commit: 55ef27f
---

# Story 1.4: Configure Android Dev and Prod Wrapper Connection

Status: ready-for-dev

Owner: Hy

<!-- Android-owned foundation story. Codex is mentor/fallback executor if Hy requests help during implementation. -->

## Story

As a personal mobile app user,
I want the Android app to have simple dev and prod connection behavior,
so that I can use the app on emulator or a personal device without managing complex connection profiles.

## Acceptance Criteria

1. Given the Android project is built, when product flavors are inspected, then the app defines exactly two MVP flavors: `dev` and `prod`, and `dev` uses application ID suffix `.dev`, app name `[DEV] Career Ops`, and default wrapper URL `http://10.0.2.2:3000`.
2. Given the `prod` flavor is built, when connection defaults are inspected, then `prod` has no application ID suffix, app name `Career Ops`, and no hardcoded default wrapper URL, and the user must enter the wrapper base URL before API calls can succeed.
3. Given the app runs in `dev` flavor, when it connects to the local Wrapper Backend from an Android emulator, then it can use cleartext HTTP for the configured local development URL, and the network security configuration is limited to dev/local development needs.
4. Given the app runs against a LAN/private backend URL, when the user saves wrapper connection settings, then the app stores only `WrapperConnectionSettings(baseUrl, pairingToken)`, and it does not create a saved endpoint list, workspace path field, or connection-profile registry for MVP.
5. Given an API request is sent from Android, when a Local Pairing Token is configured, then the Retrofit/OkHttp client attaches `X-Career-Ops-Token: <token>`, and if no token is configured, the client omits the header rather than sending an empty token.
6. Given Android connection settings are changed, when the user saves and retries connection, then subsequent API calls use the latest base URL and token, and previous failed connection attempts do not permanently block retry.
7. Given Android validation runs, when this story is complete, then `./gradlew test`, `./gradlew assembleDevDebug`, and `./gradlew assembleProdDebug` pass.

## Tasks / Subtasks

- [ ] Add Android `dev` and `prod` product flavors. (AC: 1, 2, 7)
  - [ ] Add a single flavor dimension such as `environment`.
  - [ ] Define exactly two product flavors: `dev` and `prod`.
  - [ ] Configure `dev` with `applicationIdSuffix = ".dev"`.
  - [ ] Configure `prod` with no suffix.
  - [ ] Add flavor-specific `BuildConfig` values for wrapper defaults: `CAREER_OPS_DEFAULT_BASE_URL` and any simple flavor marker such as `CAREER_OPS_ENVIRONMENT`.
  - [ ] Do not add `staging`, `qa`, endpoint-list variants, or connection-profile registry.

- [ ] Configure app labels through flavor resources or manifest placeholders. (AC: 1, 2)
  - [ ] Keep the manifest using `@string/app_name`.
  - [ ] Provide `app/src/dev/res/values/strings.xml` with `[DEV] Career Ops`.
  - [ ] Provide `app/src/prod/res/values/strings.xml` with `Career Ops`.
  - [ ] Preserve existing launcher/activity behavior and do not redesign the current Task Arena UI in this story.

- [ ] Add dev-only local cleartext network security. (AC: 3)
  - [ ] Add a `dev` network security config that permits cleartext only for emulator/local development hosts required by MVP, especially `10.0.2.2`.
  - [ ] Wire the dev flavor manifest to use the dev network security config.
  - [ ] Ensure prod does not inherit broad cleartext permission.
  - [ ] Do not set global app-wide cleartext for all domains.

- [ ] Add bounded Career Ops connection settings model and storage. (AC: 4, 6)
  - [ ] Create `WrapperConnectionSettings(baseUrl: String, pairingToken: String?)` under `app/src/main/java/com/example/careerops/domain/model/`.
  - [ ] Create a small settings data source under `app/src/main/java/com/example/careerops/data/settings/`.
  - [ ] Store only the latest `baseUrl` and optional `pairingToken`.
  - [ ] Seed dev settings from `BuildConfig.CAREER_OPS_DEFAULT_BASE_URL` when nothing has been saved.
  - [ ] Leave prod base URL empty until the user saves one in a later setup UI story.
  - [ ] Do not store Career Ops Workspace paths in Android.

- [ ] Add Retrofit/OkHttp connection foundation and Local Pairing Token interceptor. (AC: 5, 6)
  - [ ] Create `CareerOpsAuthInterceptor` under `app/src/main/java/com/example/careerops/data/api/`.
  - [ ] Attach `X-Career-Ops-Token` only when `pairingToken` is non-null and non-blank after trimming.
  - [ ] Ensure rebuilding the API client after settings changes uses the latest base URL and token.
  - [ ] Add a minimal `CareerOpsApiService` only if needed for compile/test shape; do not implement setup health UI or full DTO families here.

- [ ] Add focused unit tests. (AC: 1-7)
  - [ ] Test `WrapperConnectionSettings` default behavior for dev and prod.
  - [ ] Test settings data source save/read/update without keeping endpoint history.
  - [ ] Test `CareerOpsAuthInterceptor` attaches the header with a token and omits it without a token.
  - [ ] Test base URL validation or normalization if implemented in this story.
  - [ ] Keep tests under `app/src/test/java/com/example/careerops/`.

- [ ] Validate the Android build variants. (AC: 7)
  - [ ] Run `./gradlew test`.
  - [ ] Run `./gradlew assembleDevDebug`.
  - [ ] Run `./gradlew assembleProdDebug`.
  - [ ] If the exact variant task names differ after flavor creation, document the actual task names in the Dev Agent Record and run the equivalent dev/prod debug builds.

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

Current `app/build.gradle.kts` has no product flavors yet, no network security config, no flavor-specific resources, and no Career Ops package. `buildFeatures.buildConfig = true` is already enabled, so BuildConfig fields are available without adding another plugin.

Current package/namespace facts:

- Gradle namespace: `com.example`
- Application ID: `com.aistudio.taskarena.kymzap`
- Current app label resource: `app/src/main/res/values/strings.xml` has `Task Arena`
- Existing source package: `app/src/main/java/com/example`

### Architecture Requirements

- Android must use exactly two MVP product flavors: `dev` and `prod`.
- `dev` defaults to emulator wrapper URL `http://10.0.2.2:3000`.
- `prod` default wrapper URL is empty and must require user-entered setup URL before API calls can succeed.
- Android stores only `WrapperConnectionSettings(baseUrl, pairingToken)`.
- Do not create a saved endpoint list, workspace path field, or connection-profile registry.
- Android never sees or stores the Career Ops Workspace path.
- LAN access uses the `X-Career-Ops-Token` header.
- CORS is not relevant because Android uses Retrofit/OkHttp, not a browser.

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
app/src/main/java/com/example/careerops/domain/model/WrapperConnectionSettings.kt
app/src/main/java/com/example/careerops/data/settings/CareerOpsSettingsDataSource.kt
app/src/main/java/com/example/careerops/data/api/CareerOpsAuthInterceptor.kt
app/src/test/java/com/example/careerops/
```

The exact dev manifest strategy may vary. Prefer a small flavor manifest that only adds `android:networkSecurityConfig="@xml/network_security_config"` for dev. Avoid changing the base manifest in a way that grants cleartext to prod.

Do not create:

```text
app/src/staging/
app/src/qa/
app/src/main/java/com/example/careerops/presentation/setup/
app/src/main/java/com/example/careerops/data/database/
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
        buildConfigField("String", "CAREER_OPS_DEFAULT_BASE_URL", "\"\"")
    }
}
```

Use a stable local settings abstraction now, even if the first implementation is in-memory or backed by a simple app-private store. Later setup UI can depend on this abstraction without learning Gradle flavor details.

If using SharedPreferences for this story, keep it small and replaceable. Do not add DataStore just for this story because Story 1.8 intentionally removed unused deferred dependencies; a future story can add DataStore if there is a proven need.

Interceptor behavior should be deterministic:

```kotlin
val token = settings.pairingToken?.trim()
if (!token.isNullOrEmpty()) {
    requestBuilder.header("X-Career-Ops-Token", token)
}
```

Never send `X-Career-Ops-Token` with an empty string.

### Network Security Guidance

Android official docs confirm that Android Emulator uses `10.0.2.2` as the special alias for the host machine loopback interface. Use that for the dev default wrapper URL.

Android official network security config docs warn against broad cleartext. Keep cleartext constrained to dev/local network needs. A dev-only config may permit:

```xml
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain>10.0.2.2</domain>
        <domain>localhost</domain>
    </domain-config>
</network-security-config>
```

If Android tooling rejects IP addresses in `domain-config`, use the smallest accepted dev-only alternative and document the trade-off in the Dev Agent Record. Do not silently enable prod-wide cleartext.

### Previous Story Intelligence

- Story 1.3 health contract includes `health.ready.json` and `health.not-ready.json`. Story 1.5 will call `GET /api/v1/health`; this story only prepares the connection settings/client path.
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

- `WrapperConnectionSettingsTest`
- `CareerOpsSettingsDataSourceTest`
- `CareerOpsAuthInterceptorTest`

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

## Dev Agent Record

### Agent Model Used

TBD by dev agent

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.

### File List
