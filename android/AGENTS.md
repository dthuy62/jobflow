# AGENTS.md

JobFlow Android: one `:app` module, Jetpack Compose, Hilt, Retrofit + kotlinx.serialization, DataStore, Navigation 3.
Package root = `namespace` in `app/build.gradle.kts`. Layers: `ui/` → `domain/` ← `data/`, wired in `di/`.
Flavors: `dev` (emulator wrapper at `http://10.0.2.2:3000`, cleartext allowed) and `prod`. Workspace rules: `../AGENTS.md`.

## Verify (run before saying a task is done)

```bash
./gradlew assembleDevDebug testDevDebugUnitTest lintDevDebug detekt ktlintCheck
```

`ktlintFormat` fixes formatting. Konsist tests in `app/src/test/.../architecture/` enforce the layer rules below.

## Never

- Read or write Career Ops workspace files: the app talks only to the wrapper API (`data/remote/CareerOpsApi.kt`).
- Import `data/` from `ui/`, or Android, Room or DataStore types from `domain/`.
- Import one `ui/<feature>` from another; navigation goes through callbacks in `navigation/NavGraph.kt`.
- Catch exceptions outside `core/common` and data sources; map them with the source's mapper (`toApiError`).
- Edit generated files (`build/`, `.gradle/`); a hook blocks it.
- Change the package, applicationId or app name by hand; use the `mobile-app-config` plugin.
- Put dependency versions anywhere but `gradle/libs.versions.toml`.
- Mix MVVM-lite and MVI in one screen, or add MVC or MVP.
- Commit tokens, keystores, local workspace paths or real CV/profile content.

These fix the direction of dependencies only. How many layers a feature needs is the developer's call; propose the
lowest level that fits (skill `android-agentic-starter`).

## When you need more

| Task                                             | Read first                        |
|--------------------------------------------------|-----------------------------------|
| Write ViewModel, use case, repository or DI code | skill `android-agentic-starter`   |
| Add a screen                                     | skill `new-feature`               |
| Change Compose UI                                | `.claude/rules/compose-ui.md`     |
| Write or fix tests                               | `.claude/rules/testing.md`        |
| Understand the system, onboard, find a recipe    | `docs/README.md`                  |
| Change CI, signing, versioning or distribution   | `docs/ci-cd.md`                   |
| Make or question an architecture decision        | `docs/decisions/` and skill `adr` |
| Rename, flavors, Firebase                        | skill `setup-starter`             |

Skills live in `.claude/skills/` (also reachable as `.agents/skills/` and `.opencode/skills/`).
