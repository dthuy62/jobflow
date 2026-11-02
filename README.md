# JobFlow

JobFlow is a mobile app that finds jobs matching your CV and preferences, and
explains why they fit. It is becoming a hosted, install-and-use product; see
`docs/superpowers/specs/2026-11-02-jobflow-hosted-product-design.md`.

## Projects

- `android/` - Android app.
- `packages/safety/` - Safety helpers shared with the wrapper.
- `packages/contract/`, `contracts/` - Hosted API contract and its mock. See
  `contracts/README.md`.
- `backend/` - Hosted API, being built. See `docs/deployment-guide.md`.
- `vendor/` - Vendored Career Ops parts, planned. The hosted backend's plan is
  `docs/superpowers/plans/2026-11-02-hosted-backend-phase-1.md`.
- `career-ops-wrapper/` - Local wrapper over a Career Ops workspace. Frozen as a
  development and self-host tool.

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

Run `npm ci` once at the repo root; the wrapper is part of the npm workspace.

```bash
cd career-ops-wrapper
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
- `docs/system-architecture.md` - Hosted target, and the frozen wrapper's boundaries.
- `docs/code-standards.md` - Engineering standards for this repo.
- `docs/design-guidelines.md` - Android UX and visual guidelines.
- `docs/deployment-guide.md` - Local run, build, and release notes.
- `docs/project-roadmap.md` - Implementation roadmap.
- `docs/workflow/backend-delivery.md` - Branch, PR and merge workflow.
