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
`.kiro/` are not source-of-truth code.

## Android

The Android app is a single-module native app.

| Area | Files |
| --- | --- |
| Build | `android/settings.gradle.kts`, `android/build.gradle.kts`, `android/app/build.gradle.kts`, `android/gradle/libs.versions.toml` |
| App root | `JobFlowApplication.kt`, `AppContainer.kt`, `MainActivity.kt` |
| Core | `core/either.kt` |
| Data | `data/database/`, `data/datasource/`, `data/models/`, `data/remote/`, `data/repository/` |
| Domain | `domain/model/`, `domain/repository/`, `domain/usecase/` |
| UI | `presentation/`, `presentation/component/`, `ui/theme/` |
| Tests | `app/src/test/java/me/dthuy/jobflow/` |

Key implementation facts:

- Compose + Material 3 UI.
- MVI-style arena screen using immutable state, intents, and effects.
- Room stores task arena data in `task_arena_database`.
- Retrofit/OkHttp/kotlinx.serialization are used for wrapper API calls.
- `dev` and `prod` product flavors exist; `dev` allows cleartext access to
  `10.0.2.2`.
- Release signing reads environment variables.

## Career Ops Wrapper

The wrapper is a local TypeScript API.

| Area | Files |
| --- | --- |
| Runtime | `src/server.ts`, `src/config/` |
| Routes | `src/api/` |
| Contracts | `src/contracts/`, `contracts/examples/` |
| Services | `src/services/` |
| Workspace IO | `src/workspace/` |
| Security | `src/security/` |
| Errors | `src/errors/` |
| API docs | `src/openapi/openapi-document.ts`, `src/api/docs-routes.ts` |
| Tests | `test/` |

Implemented route families:

- `GET /api/v1/health`
- `GET /api/v1/cv`, `PUT /api/v1/cv`
- `GET /api/v1/profile`, `PUT /api/v1/profile`
- `GET /api/v1/portals`, `PUT /api/v1/portals`
- `GET /api/v1/scan-readiness`
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

## Commands

Android:

```bash
cd android
./gradlew testDevDebugUnitTest
./gradlew assembleDevDebug
./gradlew lintDevDebug
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
