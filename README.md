# JobFlow

JobFlow is a personal job application assistant.

## Projects

- `android/` - Android app.
- `career-ops-wrapper/` - Local wrapper service for Career Ops integration.

Planned, not scaffolded yet:

- `ios/`
- `flutter/`

## Android

```bash
cd android
./gradlew testDevDebugUnitTest
```

### Kotlin quality checks

Run this once per clone or worktree to enable the tracked pre-commit hook:

```bash
cd android
./gradlew installGitHooks
```

The hook runs `qualityCheck` before every commit. Run these commands directly
while developing Kotlin code:

```bash
cd android
./gradlew ktlintFormat
./gradlew qualityCheck
```

## Career Ops Wrapper

```bash
cd career-ops-wrapper
npm install
npm run dev -- --workspace /path/to/career-ops
npm test
```

## Documentation

- `docs/project-overview-pdr.md` - Product overview and requirements.
- `docs/codebase-summary.md` - Current codebase map.
- `docs/system-architecture.md` - Android-wrapper architecture and boundaries.
- `docs/code-standards.md` - Engineering standards for this repo.
- `docs/design-guidelines.md` - Android UX and visual guidelines.
- `docs/deployment-guide.md` - Local run, build, and release notes.
- `docs/project-roadmap.md` - Implementation roadmap.
