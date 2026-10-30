# Quick start

Requirements: Android Studio (current stable), JDK 21, Android SDK 37.

## Run and verify

Open the project in Android Studio and run the `app` configuration, or from a shell:

```bash
./gradlew assembleDebug
```

Verify everything before saying a task is done:

```bash
./gradlew assembleDebug testDebugUnitTest lintDebug detekt ktlintCheck
```

`./gradlew ktlintFormat` fixes formatting. This is the same command CI runs.

## Make it yours

Give the app its package, applicationId and name with the `mobile-app-config` plugin, never by hand. The steps, including
flavors and Firebase, are in skill `setup-starter` and in the root `README.md`.

## Add a screen

```bash
scripts/new-feature.sh profile          # MVVM-lite
scripts/new-feature.sh profile --mvi    # MVI with a Contract file
```

Register the route in `navigation/NavGraph.kt`:

```kotlin
entry<ProfileRoute> { ProfileScreen(onBack = { backStack.removeLastOrNull() }) }
```

Keep it simple first: inject a domain repository interface into the ViewModel and add a use case only when logic is real
or shared ([code standards](code-standards.md#how-much-structure-per-feature)). More recipes:
[module guides](module-guides.md).

## Turn on the local checks

```bash
scripts/install-git-hooks.sh
```

The pre-commit hook runs `ktlintCheck` and `detekt` when Kotlin files are staged. Skip it once with
`git commit --no-verify`; CI still runs the full command on every push to `main` and every pull request.

## Send builds to testers

Merging a pull request into `develop` builds a signed release APK and sends it to Firebase App Distribution. It needs a
one-time setup (Firebase app, signing key, GitHub secrets); without it the step is skipped and CI stays green. See
[CI/CD](ci-cd.md).

## Where to read next

[System architecture](system-architecture.md) for the big picture, [codebase summary](codebase-summary.md) for where
things live, and `AGENTS.md` for the rules AI agents follow.
