# Quick start

Requirements: Android Studio (current stable), JDK 21, Android SDK 37, and Docker for the server.

## Run

Start a server first: the backend (`../docs/deployment-guide.md`) or the contract's mock (`../contracts/README.md`). The
mock also needs `devApiBaseUrl` in `local.properties`; see `app/build.gradle.kts`.

A fresh clone needs two ignored files before it builds, once per machine:

```bash
cd android
base64 --decode < debug.keystore.base64 > debug.keystore
cp ci/google-services.json app/google-services.json
```

The second is a placeholder: enough to compile and run unit tests, but signing in needs the real file from the Firebase
project (skill `setup-starter`).

Then run the `app` configuration with the `devDebug` variant on an emulator. From a shell:

```bash
./gradlew assembleDevDebug
```

Verify everything before saying a task is done:

```bash
./gradlew assembleDevDebug testDevDebugUnitTest lintDevDebug detekt ktlintCheck
```

`./gradlew ktlintFormat` fixes formatting. CI runs this command, and also compiles the instrumented tests.

## Add a screen

```bash
scripts/new-feature.sh profile          # MVVM-lite
scripts/new-feature.sh profile --mvi    # MVI with a Contract file
```

Register the route in `navigation/NavGraph.kt`:

```kotlin
entry<ProfileRoute> { ProfileScreen(contentPadding = innerPadding) }
```

Keep it simple first: inject a domain repository interface into the ViewModel and add a use case only when logic is real
or shared ([code standards](code-standards.md#how-much-structure-per-feature)). New API calls follow
[add an API endpoint](module-guides.md#add-an-api-endpoint).

## Turn on the local checks

From the workspace root, once per clone:

```bash
git config core.hooksPath .githooks
```

The pre-commit hook runs `ktlintCheck` and `detekt`. Skip it once with `git commit --no-verify`; CI still runs the
full command on every push to `main` and every pull request.

## Where to read next

[System architecture](system-architecture.md) for the big picture, [codebase summary](codebase-summary.md) for where
things live, and `AGENTS.md` for the rules AI agents follow.
