# Android Agentic Starter

Single-module Android app: Jetpack Compose, Clean Architecture, Hilt, Room, DataStore, Navigation 3.
Organized by package like `998_16_kai`, with a `domain/` layer and use cases added.
Two presentation patterns, each used where it fits: **MVVM-lite** (default) and **MVI** (complex screens).

## Run it

Requirements: Android Studio (current stable), JDK 21, Android SDK 37.

```bash
./gradlew assembleDebug testDebugUnitTest lintDebug detekt ktlintCheck
```

Architecture rules are checked by Konsist tests, code smells by detekt (`config/detekt/detekt.yml`), formatting by
ktlint (`./gradlew ktlintFormat` fixes it).

## Layout

```
app/src/main/kotlin/<your/package>
├── core/        common (AppError, Outcome, DispatcherProvider), mvi (MviViewModel)
├── domain/      model, repository (interfaces), engine (ports), usecase
├── data/        local (Room), preferences (DataStore), engine, repository/impl
├── di/          Hilt modules
├── navigation/  NavGraph
└── ui/          theme, chat (MVI example), settings (MVVM-lite example)
```

## First 10 minutes

1. Give the app its identity with the [mobile-app-config](https://github.com/dthuy62/mobile-app-config) plugin.
   Claude Code offers to install it when you open this folder (see `.claude/settings.json`); then run
   `/mobile-app-config:android` and ask for your package and app name. From a shell:
   ```bash
   pipx install git+https://github.com/dthuy62/mobile-app-config.git
   mobile-app-config package-name --application-id com.acme.app --app-name "Acme" --root-project-name "acme-android"
   ```
   Codex: `codex plugin marketplace add dthuy62/mobile-app-config`. Flavors (`dev`, `stg`, `prod`) are optional:
   `mobile-app-config flavors`.
2. Add a screen: `scripts/new-feature.sh profile`, then register it in `navigation/NavGraph.kt`.
3. Swap the assistant: implement `domain/engine/ChatEngine` (Gemini, on-device model, your API),
   then change one `@Binds` in `di/RepositoryModule.kt`.
4. Read `docs/README.md` (guides, architecture, decisions) and `AGENTS.md` (same rules for AI agents).
5. Enable the pre-commit hook once per clone: `scripts/install-git-hooks.sh`. It runs `ktlintCheck` and `detekt` when
   Kotlin files are staged. GitHub Actions (`.github/workflows/ci.yml`) runs the full verify command on every push to
   `main` and every pull request.

## Working with AI agents

- `AGENTS.md` holds the commands and never-break rules for every agent; `CLAUDE.md` imports it.
- Skills in `.claude/skills/` (`android-agentic-starter`, `new-feature`, `setup-starter`, `adr`) load on demand.
  Codex and OpenCode read them through the `.agents/skills` and `.opencode/skills` symlinks. On Windows, enable
  Developer Mode and `git config --global core.symlinks true` before cloning, or those agents will not see them.
- Architecture decisions and their reasons: `docs/decisions/`.
- Hooks (`.claude/settings.json`, `.codex/hooks.json`) block edits to generated files and flag Kotlin files over
  400 lines. They need `python3`. Test the agent layer with `python3 -m unittest discover -s tools/agents -t tools/agents`.

## Not included on purpose (add when needed)

Firebase SDK and Crashlytics, product flavors, a network layer, and a store (Play) release pipeline.
Test builds to Firebase App Distribution are included: see `docs/ci-cd.md`.
