# CI/CD

JobFlow lives in a monorepo, so GitHub Actions workflows sit at the workspace root, not in `android/`
([ADR 8](decisions/0008-rebuild-jobflow-android-from-starter.md)). The starter's fastlane and Firebase App Distribution
pipeline is not used here ([ADR 7](decisions/0007-distribute-test-builds-with-fastlane-and-firebase.md)).

## What runs when

| Trigger | Workflow | Jobs |
|---|---|---|
| Push to `main` or a pull request touching `android/`, the wrapper contracts or the workflow | `../.github/workflows/android.yml` | `verify` (the verify command from `AGENTS.md`), `agent-layer` (hook and instruction tests), `release-build` (unsigned `assembleProdRelease` with R8) |
| Push to `main` or a pull request touching `career-ops-wrapper/` | `../.github/workflows/wrapper.yml` | `npm ci`, `npm test`, `npm run build` |

Android tests read `career-ops-wrapper/contracts/`, so a contract change runs both workflows and fails until the DTOs,
fixtures and `ApiErrorCode` agree.

## Versioning

- `versionName` is set in `app/build.gradle.kts`.
- `versionCode` comes from the Gradle property `versionCode` (default 1): `./gradlew assembleProdRelease -PversionCode=7`.

## Signing

- Debug builds use the shared debug key: decode `debug.keystore.base64` into `debug.keystore` once per machine so debug
  installs keep one signature across machines. `*.keystore` is git-ignored.
- Release builds are signed only when `ANDROID_KEYSTORE_FILE`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and
  `ANDROID_KEY_PASSWORD` are set; otherwise the release APK stays unsigned. Never commit the keystore or its passwords.

## Before shipping a release

- Install a minified release build and check that wrapper JSON still parses (R8 is on; add keep rules to
  `app/proguard-rules.pro` for `data/remote/dto` only if parsing fails).
- Decide the production endpoint and turn off cleartext for it (Epic 7: HTTPS, pairing token storage, App Check).
