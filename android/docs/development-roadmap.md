# Development roadmap

## Complete

- [x] Identity and setup through `mobile-app-config`, with a setup skill
- [x] Agent instruction layer: `AGENTS.md`, skills, rules, hooks, ADRs
- [x] Konsist architecture tests, detekt and ktlint (including the AGP 9 fix that made ktlint check Kotlin sources)
- [x] `scripts/new-feature.sh` with an MVI option and a starter test
- [x] Structure levels for features ([ADR 5](decisions/0005-scale-structure-with-feature-complexity.md))
- [x] GitHub Actions workflow and a pre-commit hook
- [x] Test-build pipeline: fastlane, signed release APK, Firebase App Distribution on merge to `develop`
      ([ADR 7](decisions/0007-distribute-test-builds-with-fastlane-and-firebase.md))
- [x] Documentation set and `DocsTest` (docs drift checks in the unit tests)
- [x] Room upgraded to 3.0.3 ([ADR 6](decisions/0006-use-room-3.md))
- [x] CI runs green on GitHub (verify and agent-layer jobs); chat and theme switching checked on an emulator

## Next

- [ ] Create `develop`, protect it, add the Firebase secrets and run the distribution pipeline once; confirm the required
      check names and fix anything runner-specific ([CI/CD](ci-cd.md))
- [ ] Release notes written from the actual changes (AI or otherwise), replacing the commit-subject list
- [ ] Install and smoke-test a release build (R8 is on and `proguard-rules.pro` is empty)
- [ ] Tests for `SendMessageUseCase`, `ChatRepositoryImpl` and `DataStoreSettingsRepository`; move
      `MainDispatcherRule` out of `ui/chat/Fakes.kt` into a shared test folder
- [ ] More Konsist rules: `domain/` must not import `ui/` or `data/`, `data/` must not import `ui/`, naming and location
      of ViewModels and use cases
- [ ] `androidTest` with `room3-testing` to test migrations, when the first migration appears
- [ ] A lightweight way to record a deliberate exception to a Konsist rule
- [ ] A real engine behind `ChatEngine` and a network layer, when a project needs them
- [ ] Extract Gradle modules (level 3) when build time or team ownership calls for it

## Dependency note

detekt is on 1.23.8 while the project uses a much newer Kotlin; it works today. Check it again whenever Kotlin is
upgraded.
