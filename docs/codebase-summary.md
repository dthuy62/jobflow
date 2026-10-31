# Codebase Summary

## Repository Shape

JobFlow is a two-project workspace:

```text
jobflow/
├── android/
├── career-ops-wrapper/
├── docs/
├── README.md
└── _bmad-output/
```

Generated/cache directories such as `android/build/`,
`career-ops-wrapper/dist/`, `.gradle/`, `.idea/`, `.agents/`, `.claude/`, and
`.kiro/` are not source-of-truth code. The one tracked exception is
`.claude/skills/review-change/`, the multi-layer review skill used in step 5
of `docs/workflow/backend-delivery.md`.

## Android

The Android app is a single-module native app.

| Area | Files |
| --- | --- |
| Build | `android/settings.gradle.kts`, `android/build.gradle.kts`, `android/app/build.gradle.kts`, `android/gradle/libs.versions.toml` |
| App root | `MainApplication.kt` (Hilt), `MainActivity.kt` |
| Core | `core/common/` (`Either`, `AppError`, `ApiErrorCode`), `core/mvi/` |
| Data | `data/remote/` (`CareerOpsApi`, DTOs, `toApiError`), `data/repository/impl/` |
| Domain | `domain/model/`, `domain/repository/` |
| UI | `ui/home/`, `ui/inputs/`, `ui/settings/`, shared `ui/components/`, `ui/health/`, `ui/theme/`; `navigation/` |
| DI | `di/` Hilt modules |
| Tests | `app/src/test/kotlin/me/dthuy/jobflow/` |

Key implementation facts:

- Rebuilt from android-agentic-starter (`android/docs/decisions/0008-rebuild-jobflow-android-from-starter.md`).
- Compose + Material 3 UI with the JobFlow soft palette and a glass bottom bar.
- Home is MVI; Settings is MVVM-lite; three Navigation 3 tabs keep Home at the
  bottom of the stack.
- Retrofit/OkHttp/kotlinx.serialization call the wrapper; contract tests parse
  `career-ops-wrapper/contracts/examples` and `contracts/error-codes.json`.
- Errors: `Either<AppError, T>`, one mapper per data source, one UI mapper.
- Konsist enforces layers; detekt and ktlint run in the verify command and CI.
- `dev` and `prod` product flavors exist; `dev` allows cleartext access to
  `10.0.2.2`.
- No Room yet; it returns as a cache in Story 2.6.
- Release signing reads environment variables.

## Career Ops Wrapper

The wrapper is a local TypeScript API.

| Area | Files |
| --- | --- |
| Runtime | `src/server.ts`, `src/config/` |
| Routes | `src/api/` |
| Contracts | `src/contracts/`, `contracts/examples/` |
| Services | `src/services/` (incl. `career-ops-projection.ts`) |
| Parsers | `src/parsers/` |
| Scan engine | `src/career-ops-engine/`, `src/runs/` |
| Workspace IO | `src/workspace/` |
| Output PDFs | `src/outputs/` |
| Security | `src/security/` |
| Errors | `src/errors/` |
| API docs | `src/openapi/openapi-document.ts`, `src/api/docs-routes.ts` |
| Tests | `test/` |
| Fixtures | `fixtures/workspaces/` (synthetic only) |

Implemented route families:

- `GET /api/v1/health`
- `GET /api/v1/cv`, `PUT /api/v1/cv`
- `GET /api/v1/profile`, `PUT /api/v1/profile`
- `GET /api/v1/portals`, `PUT /api/v1/portals`
- `GET /api/v1/scan-readiness`
- `POST /api/v1/scan-runs`, `GET /api/v1/scan-runs/latest`, `GET /api/v1/scan-runs/{id}`
- `GET /api/v1/offers`, `GET /api/v1/offers/{id}`
- `GET /api/v1/reports`, `GET /api/v1/reports/{id}`
- `GET /api/v1/artifacts`, `GET /api/v1/artifacts/{id}/download`
- `GET /docs`
- `GET /openapi.json`

Security and safety mechanisms:

- Localhost mode can omit pairing token.
- LAN/private host mode requires `X-Career-Ops-Token` for protected routes.
- Workspace path guard rejects absolute paths, `..`, empty paths, and resolved
  paths outside the workspace.
- Safe file adapter writes through temp files, keeps backups when possible, and
  verifies written content.
- Error mapping returns stable API error codes.
- Scan execution spawns only `scan.mjs` with `--dry-run`/`--company`, no shell,
  a timeout, and redacted bounded output.
- Reads of `data/`, `reports/`, and `output/` are size-capped and skip
  symlinks that leave the workspace.
- `test/security-boundaries.test.ts` checks token enforcement on every
  documented route, traversal IDs, and path/token leakage.

## Commands

Android:

```bash
cd android
./gradlew assembleDevDebug testDevDebugUnitTest lintDevDebug detekt ktlintCheck
```

Wrapper:

```bash
cd career-ops-wrapper
npm install
npm run dev -- --workspace /path/to/career-ops
npm run build
npm test
```

## Scout Notes

- Root docs did not exist before this initialization.
- Existing `android/AGENTS.md` and `android/CLAUDE.md` are Android-specific.
- Several Android and wrapper files are currently modified in the worktree;
  documentation should not assume they are committed.
