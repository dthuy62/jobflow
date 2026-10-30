# Quick start

Requirements: Android Studio (current stable), JDK 21, Android SDK 37, and Node for the wrapper.

## Run against a local wrapper

```bash
cd ../career-ops-wrapper
npm run dev -- --workspace /path/to/career-ops
curl http://127.0.0.1:3000/api/v1/health
```

Then run the `app` configuration with the `devDebug` variant on an emulator; `dev` reaches the host at
`http://10.0.2.2:3000`. From a shell:

```bash
./gradlew assembleDevDebug
```

Verify everything before saying a task is done:

```bash
./gradlew assembleDevDebug testDevDebugUnitTest lintDevDebug detekt ktlintCheck
```

`./gradlew ktlintFormat` fixes formatting. This is the same command CI runs.

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
or shared ([code standards](code-standards.md#how-much-structure-per-feature)). New wrapper calls follow
[add a wrapper endpoint](module-guides.md#add-a-wrapper-endpoint).

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
