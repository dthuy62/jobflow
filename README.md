# JobFlow

JobFlow is a personal job application assistant.

## Projects

- `android/` - Android app.
- `career-ops-wrapper/` - Local wrapper service for Career Ops integration.

Planned, not scaffolded yet:

- `ios/`
- `flutter/`

## Android

Built from android-agentic-starter: Compose, Hilt, Retrofit, Navigation 3. See
`android/README.md` and `android/docs/`.

```bash
cd android
./gradlew assembleDevDebug testDevDebugUnitTest lintDevDebug detekt ktlintCheck
```

### Pre-commit hook

Run this once per clone or worktree to enable the tracked hook (ktlint + detekt):

```bash
git config core.hooksPath .githooks
```

`cd android && ./gradlew ktlintFormat` fixes formatting. CI runs
`.github/workflows/android.yml` and `.github/workflows/wrapper.yml`.

## Career Ops Wrapper

```bash
cd career-ops-wrapper
npm install
npm run dev -- --workspace /path/to/career-ops
npm test
```

AI offer evaluation from the app is off by default. To enable it, log in the
desktop `claude` CLI once (`claude auth login`) and set
`CAREER_OPS_EVALUATION_PROVIDER=claude`; each evaluation uses the desktop's
Claude subscription quota. See `career-ops-wrapper/README.md`.

## Documentation

- `docs/project-overview-pdr.md` - Product overview and requirements.
- `docs/codebase-summary.md` - Current codebase map.
- `docs/system-architecture.md` - Android-wrapper architecture and boundaries.
- `docs/code-standards.md` - Engineering standards for this repo.
- `docs/design-guidelines.md` - Android UX and visual guidelines.
- `docs/deployment-guide.md` - Local run, build, and release notes.
- `docs/project-roadmap.md` - Implementation roadmap.
- `docs/workflow/backend-delivery.md` - Branch, PR and merge workflow.
