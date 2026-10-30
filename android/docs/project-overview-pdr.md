# Product requirements

## Product

JobFlow Android is the mobile interface of JobFlow, a personal job-search assistant built on Career Ops. It checks the
local wrapper and workspace, and grows into editing career inputs, running scans and reviewing offers, reports and
artifacts. Product scope and boundaries for the whole workspace live in `../../docs/project-overview-pdr.md`; this file
covers the Android app's engineering requirements.

## Goals

- Keep the Android-wrapper boundary: the app only calls the wrapper API and never reads or writes workspace files.
- Keep layer boundaries testable and enforced: `ui/` does not import `data/`, `domain/` stays free of Android, features
  do not import each other, and only data sources catch exceptions.
- Let each feature choose how much structure it needs without breaking the dependency direction
  ([ADR 5](decisions/0005-scale-structure-with-feature-complexity.md)).
- Couple the app to the wrapper's contracts with tests, so a contract change cannot silently break the app.
- Keep files small and instructions short for precise human and agent edits.

## Requirements

1. One Gradle module, `:app`, organized by package ([ADR 1](decisions/0001-use-a-single-app-module.md)).
2. MVVM-lite by default and MVI where a screen needs it; one pattern per screen
   ([ADR 2](decisions/0002-default-to-mvvm-lite-and-use-mvi-when-needed.md)).
3. Expected failures are `Either<AppError, T>` values mapped at two boundaries, and cancellation is never swallowed
   ([ADR 10](decisions/0010-use-either-and-two-boundary-error-mapping.md)).
4. Wrapper access goes through Retrofit and kotlinx.serialization with DTOs that mirror the wrapper's Zod contracts
   ([ADR 9](decisions/0009-retrofit-kotlinx-serialization-network-layer.md)).
5. App identity changes only through the `mobile-app-config` plugin
   ([ADR 4](decisions/0004-change-identity-via-mobile-app-config.md)).
6. Dependency versions live only in `gradle/libs.versions.toml`.
7. Logs and UI never show tokens, workspace paths or CV/profile content; `AppError` carries no exception text.
8. Konsist, detekt, ktlint, contract tests and docs checks run in the verify command and in CI.

## Non-goals (for now)

A production endpoint and HTTPS pinning (Epic 7), offline cache (Story 2.6), Firebase SDKs, a Play release pipeline,
feature modules, and a shared base ViewModel hierarchy beyond `MviViewModel`.

## Acceptance

```bash
./gradlew assembleDevDebug testDevDebugUnitTest lintDevDebug detekt ktlintCheck
python3 -m unittest discover -s tools/agents -t tools/agents
```

The first command is the verify command from `AGENTS.md`; it includes the docs and contract checks. The second is only
needed when working on the agent hooks and instructions in `tools/agents/`, and needs Python 3.
