# JobFlow Android

Native Android client for JobFlow. It talks to the local Career Ops wrapper (`../career-ops-wrapper`) over HTTP and
never touches workspace files itself. Built from
[android-agentic-starter](https://github.com/dthuy62/android-agentic-starter)
([ADR 8](docs/decisions/0008-rebuild-jobflow-android-from-starter.md)).

Single module: Jetpack Compose, Hilt, Retrofit + kotlinx.serialization, Navigation 3. Two presentation
patterns, each used where it fits: **MVVM-lite** (default) and **MVI** (complex screens).

## Run it

Requirements: Android Studio (current stable), JDK 21, Android SDK 37.

```bash
./gradlew assembleDevDebug testDevDebugUnitTest lintDevDebug detekt ktlintCheck
```

The `dev` flavor reaches a wrapper running on the host at `http://10.0.2.2:3000` from the emulator:

```bash
cd ../career-ops-wrapper && npm run dev -- --workspace /path/to/career-ops
```

Architecture rules are checked by Konsist tests, code smells by detekt (`config/detekt/detekt.yml`), formatting by
ktlint (`./gradlew ktlintFormat` fixes it). Contract tests read the wrapper's checked-in JSON examples, so a contract
change fails here until the DTOs follow.

## Layout

```
app/src/main/kotlin/me/dthuy/jobflow
├── core/        common (Either, AppError, ApiErrorCode, unexpected), mvi (MviViewModel)
├── domain/      model (Health, HealthSnapshot), repository (interfaces)
├── data/        remote (CareerOpsApi, DTOs, toApiError), repository/impl
├── di/          Hilt modules
├── navigation/  NavGraph, tabs, glass bottom bar
└── ui/          theme, components, health (shared), home (MVI), inputs, settings (MVVM-lite)
```

## Working with AI agents

- `AGENTS.md` holds the commands and never-break rules for every agent; `CLAUDE.md` imports it.
- Skills in `.claude/skills/` (`android-agentic-starter`, `new-feature`, `setup-starter`, `adr`) load on demand.
  Codex and OpenCode read them through the `.agents/skills` and `.opencode/skills` symlinks.
- Architecture decisions and their reasons: `docs/decisions/`.
- Hooks (`.claude/settings.json`, `.codex/hooks.json`) block edits to generated files and flag Kotlin files over
  400 lines when an agent session is opened in this folder. Test them with
  `python3 -m unittest discover -s tools/agents -t tools/agents`.
- The repository's pre-commit hook lives at the workspace root (`../.githooks/pre-commit`, enable with
  `git config core.hooksPath .githooks`); CI runs from `../.github/workflows/android.yml`.
