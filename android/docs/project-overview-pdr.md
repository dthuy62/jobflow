# Product requirements

## Product

Android Agentic Starter is a starter project for Android apps that humans and AI coding agents extend together. It
ships a small, explicit architecture with a working example of each presentation pattern, and enforces its rules with
tests and linters instead of prose alone.

## Goals

- Keep layer boundaries testable and enforced: `ui/` does not import `data/`, `domain/` stays free of Android, features
  do not import each other.
- Let each feature choose how much structure it needs, from a few files to the full stack, without breaking the
  dependency direction ([ADR 5](decisions/0005-scale-structure-with-feature-complexity.md)).
- Keep files small enough for precise agent edits, and give agents short, reliable instructions (`AGENTS.md`, skills,
  rules, hooks).
- Make the AI seam obvious: replacing the chat engine touches `data/` and one `@Binds`.
- Fail fast: the same checks run in agent hooks, an optional pre-commit hook and CI.

## Requirements

1. One Gradle module, `:app`, organized by package ([ADR 1](decisions/0001-use-a-single-app-module.md)).
2. MVVM-lite by default and MVI where a screen needs it; one pattern per screen
   ([ADR 2](decisions/0002-default-to-mvvm-lite-and-use-mvi-when-needed.md)).
3. Expected failures are `Outcome`/`AppError` values, and cancellation is never swallowed
   ([ADR 3](decisions/0003-return-outcome-for-expected-failures.md)).
4. App identity changes only through the `mobile-app-config` plugin
   ([ADR 4](decisions/0004-change-identity-via-mobile-app-config.md)).
5. Dependency versions live only in `gradle/libs.versions.toml`.
6. The example app (chat with a placeholder engine, settings) runs end to end with no backend.
7. Konsist, detekt and ktlint run in the verify command and in CI.
8. A merge into `develop` builds a signed release APK and sends it to Firebase App Distribution, and does nothing
   (CI stays green) when Firebase is not configured ([ADR 7](decisions/0007-distribute-test-builds-with-fastlane-and-firebase.md)).

## Non-goals

These are left out on purpose and added when a project needs them: Firebase SDK and Crashlytics, product flavors
(available through `mobile-app-config`), a network layer, a store (Play) release pipeline, AAB uploads, feature modules from day one,
and a shared base ViewModel hierarchy beyond `MviViewModel`.

## Acceptance

```bash
./gradlew assembleDebug testDebugUnitTest lintDebug detekt ktlintCheck
python3 -m unittest discover -s tools/agents -t tools/agents
```

The first command is the verify command from `AGENTS.md`; it includes the docs checks. The second is only needed when
working on the agent hooks and instructions in `tools/agents/`, and needs Python 3.
