---
created: 2026-06-21
story_key: 1-3-expose-health-and-workspace-readiness-api
owner: Codex
baseline_commit: f52d54296ca205fef486f4213781ceabebdefa82
---

# Story 1.3: Expose Health and Workspace Readiness API

Status: done

Owner: Codex

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a personal mobile app user,
I want the Android app to receive truthful backend, workspace, and Career Ops script readiness status,
so that I know whether Career Ops is ready before trying to scan jobs.

## Acceptance Criteria

1. Given the Wrapper Backend is running, when `GET /api/v1/health` is called, then the response includes backend service availability, API version, workspace readiness, Career Ops local script runner readiness, capabilities, and an ISO timestamp, and the response follows the checked-in Health DTO schema.
2. Given the configured Career Ops Workspace is valid, when `GET /api/v1/health` is called, then the response marks workspace readiness as ready and includes concise readiness messages suitable for Android display without exposing absolute local workspace paths.
3. Given the wrapper is running but the Career Ops Workspace is missing, invalid, unreadable, or missing required files, when `GET /api/v1/health` is called, then the response marks readiness as not ready and identifies the failure category without exposing sensitive local file details.
4. Given the Career Ops local scan script path is unavailable, when `GET /api/v1/health` is called, then the response marks scanner/script readiness as not ready and Android can block scan start actions based on that readiness state.
5. Given the configured Career Ops Workspace is valid, when `GET /api/v1/health` is called, then the response includes zero-token script readiness for `doctor.mjs`, `scan.mjs`, and `portals.yml`, and it does not require or report Gemini/OpenAI/Anthropic provider API-key readiness for MVP scan capability.
6. Given the backend is unavailable or returns malformed data, when Android requests health in later stories, then the health contract is stable enough for Android to classify wrapper unreachable or invalid response without claiming Android can install or repair Career Ops automatically.
7. Given contract examples are inspected or tests run, when health schemas/examples are validated, then `health.ready.json` and `health.not-ready.json` reflect the new readiness fields and do not advertise unimplemented scan-run, reports, artifacts, AI CLI, or API-key evaluator capabilities as ready.

## Tasks / Subtasks

- [x] Expand the Health DTO contract for readiness. (AC: 1, 2, 3, 4, 5, 7)
  - [x] Add `apiVersion` to `HealthDtoSchema` with value shape suitable for `/api/v1`.
  - [x] Add a dedicated Career Ops readiness object separate from `capabilities`.
  - [x] Represent local script runner readiness without adding provider API-key readiness requirements.
  - [x] Preserve existing top-level `status`, `workspace`, `capabilities`, and `serverTime` fields unless a contract test intentionally updates them.
  - [x] Keep `capabilities.scan`, `capabilities.reports`, and `capabilities.artifacts` false until their API endpoint families exist.

- [x] Implement local script readiness checks. (AC: 1, 4, 5)
  - [x] Add a focused readiness module under `career-ops-wrapper/src/career-ops-engine/` or `src/workspace/` for fixed local script checks.
  - [x] Check that `doctor.mjs`, `scan.mjs`, and `portals.yml` exist and are readable inside the configured workspace.
  - [x] Use stable requirement keys such as `doctor-script`, `scan-script`, and `portal-config`.
  - [x] Return a script readiness status and concise messages without absolute paths.
  - [x] Do not execute `doctor.mjs`, `scan.mjs`, `npm run scan`, Antigravity, Claude, Gemini, Codex, OpenCode, Qwen, or any provider API-key script in this story.

- [x] Update health aggregation. (AC: 1, 2, 3, 4, 5)
  - [x] Update `HealthService` to combine workspace health and script readiness into a truthful top-level service status.
  - [x] Use `ready` only when workspace readiness and required local script readiness are ready.
  - [x] Use `notReady` when workspace or script readiness blocks later scan stories.
  - [x] Add Android-readable readiness messages that identify failing categories without exposing local paths or secret values.
  - [x] Keep `/api/v1/health` public in LAN mode as established by Story 1.2.

- [x] Update contract examples and documentation. (AC: 1, 6, 7)
  - [x] Update `career-ops-wrapper/contracts/examples/health.ready.json`.
  - [x] Update `career-ops-wrapper/contracts/examples/health.not-ready.json`.
  - [x] Add or update tests so contract examples parse through the Zod schemas.
  - [x] Update wrapper README health section with localhost command examples and the zero-token script readiness meaning.
  - [x] Explicitly document that script readiness is not AI CLI readiness and not provider API-key readiness.

- [x] Add fixture workspace coverage for readiness. (AC: 2, 3, 4, 5, 7)
  - [x] Add valid fixture coverage for the real `npx @santifer/career-ops init` layout: `cv.md`, `config/profile.yml`, `portals.yml`, `doctor.mjs`, and `scan.mjs`.
  - [x] Add missing `doctor.mjs` fixture.
  - [x] Add missing `scan.mjs` fixture.
  - [x] Add missing `portals.yml` fixture.
  - [x] Keep fixtures deterministic and small; no real Career Ops process should run.

- [x] Author tests before implementation and keep them green. (AC: 1-7)
  - [x] Add contract tests for the expanded Health DTO and examples.
  - [x] Add unit tests for script readiness: ready, missing doctor, missing scan, missing portals, unreadable-if-portable.
  - [x] Add health service tests proving readiness aggregation and capabilities behavior.
  - [x] Add Fastify route tests proving `/api/v1/health` returns the new schema and remains public with query strings in LAN mode.
  - [x] Add negative tests proving no generic command endpoint and no shell command body is introduced.
  - [x] Run `npm test` and `npm run build` in `career-ops-wrapper`.
  - [x] Run repo-level `./gradlew test` to guard Android regression even though Android implementation is out of scope.

### Review Findings

- [x] [Review][Patch] Validate script readiness prerequisites as regular in-workspace files [career-ops-wrapper/src/career-ops-engine/script-readiness.ts:53]
- [x] [Review][Patch] Validate workspace required source files as readable regular files [career-ops-wrapper/src/workspace/workspace-health.ts:100]
- [x] [Review][Patch] Align portal config filename handling between workspace and scanner readiness [career-ops-wrapper/src/workspace/workspace-health.ts:106]
- [x] [Review][Patch] Preserve listability/read failure categories instead of collapsing them into structure invalid [career-ops-wrapper/src/workspace/workspace-health.ts:77]
- [x] [Review][Patch] Close Fastify test servers in finally blocks [career-ops-wrapper/test/health-route.test.ts:7]
- [x] [Review][Defer] Public health endpoint performs workspace write probes [career-ops-wrapper/src/workspace/workspace-health.ts:42] — deferred, pre-existing

## Dev Notes

### Scope Boundary

This story is a readiness/contract story. It must not implement CV/Profile/Portal read/write APIs, scan-run creation, subprocess scan execution, offer parsing, Android UI, Room cache, AI CLI automation, or provider API-key evaluator integration.

The outcome is a truthful health API that Android can later use to distinguish:

- wrapper reachable;
- workspace valid/invalid;
- local zero-token scan script prerequisites present/missing;
- API capabilities implemented/not implemented.

### Correct Course Context

The approved execution strategy correction before this story established:

- MVP scan execution uses the Career Ops local script runner: `node scan.mjs` or equivalent `npm run scan` inside the configured Career Ops Workspace.
- This path is zero-token and does not require Gemini/OpenAI/Anthropic API keys.
- Backend wrapper must expose only typed allowlisted operations, never arbitrary shell commands.
- Native AI CLI slash-command workflows such as Antigravity, Claude, Gemini CLI, Codex, OpenCode, and Qwen are deferred until a headless/non-interactive spike proves them.
- Standalone API-key evaluator scripts such as `gemini-eval.mjs` are optional future provider mode because of cost/token concerns.

Implication for this story: detect local script readiness only. Do not start scripts and do not check provider API keys.

### Existing Implementation Snapshot

Story 1.2 left the wrapper in this state:

- `createServer()` lives in `career-ops-wrapper/src/server.ts`.
- Route registration lives in `src/api/register-routes.ts`.
- Health route lives in `src/api/health-routes.ts` and should stay route-mapping only.
- Health orchestration lives in `src/services/health-service.ts`.
- Workspace validation lives in `src/workspace/workspace-health.ts`.
- Runtime config has `host`, `port`, `workspace`, and optional `pairingToken`.
- `GET /api/v1/health` is public even in LAN/private mode and supports query strings.
- Local Pairing Token guard protects non-health `/api/v1` routes only.
- Existing tests pass with 10 test files and 67 tests after the real Career Ops layout patch.

Current `HealthDtoSchema` has:

```text
status
workspace
capabilities
serverTime
```

This story should extend it, not create a parallel health endpoint.

### Recommended Health DTO Shape

Keep current fields and add readiness fields instead of overloading `capabilities`.

Recommended additive shape:

```json
{
  "status": "ready",
  "apiVersion": "v1",
  "workspace": {
    "status": "ready",
    "detected": true,
    "careerOpsVersion": null,
    "missingRequirements": [],
    "messages": ["Career Ops workspace is ready."]
  },
  "careerOps": {
    "status": "ready",
    "executionMode": "local-script-runner",
    "providerApiKeyRequired": false,
    "aiCliRequired": false,
    "scanner": {
      "status": "ready",
      "commandType": "local-script",
      "missingRequirements": [],
      "checks": [
        { "name": "doctor-script", "status": "ready" },
        { "name": "scan-script", "status": "ready" },
        { "name": "portal-config", "status": "ready" }
      ],
      "messages": ["Local Career Ops scan script prerequisites are present."]
    }
  },
  "capabilities": {
    "cv": true,
    "profile": true,
    "portals": true,
    "scan": false,
    "reports": false,
    "artifacts": false,
    "cvConversion": false,
    "geminiEvaluation": false
  },
  "serverTime": "2026-06-21T00:00:00.000Z"
}
```

Notes:

- `careerOps.scanner.status` can be `ready` even while `capabilities.scan` remains `false`; readiness says the local script prerequisites exist, capability says the scan-run API is not implemented yet.
- Use stable enum strings. Recommended readiness statuses: `ready`, `missing`, `invalid`, `notReady`, `unknown` as needed, but do not add excessive states without tests.
- Keep messages concise and path-free.
- Do not include absolute workspace path, full CV content, profile content, token values, or provider secrets in DTOs.

### Local Script Readiness Rules

Required MVP local script readiness checks:

| Requirement key | Workspace location | Check |
| --- | --- | --- |
| `doctor-script` | `doctor.mjs` | exists and readable |
| `scan-script` | `scan.mjs` | exists and readable |
| `portal-config` | `portals.yml` | exists and readable |

Do not require:

- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- Antigravity/Claude/Gemini/Codex CLI binaries
- `gemini-eval.mjs`
- successful scan execution
- successful `doctor.mjs` execution

### File Structure Requirements

Expected files to create or modify:

```text
career-ops-wrapper/src/contracts/health-contract.ts
career-ops-wrapper/src/services/health-service.ts
career-ops-wrapper/src/api/health-routes.ts
career-ops-wrapper/src/workspace/workspace-health.ts
career-ops-wrapper/src/career-ops-engine/script-readiness.ts
career-ops-wrapper/contracts/examples/health.ready.json
career-ops-wrapper/contracts/examples/health.not-ready.json
career-ops-wrapper/test/contract-examples.test.ts
career-ops-wrapper/test/health-route.test.ts
career-ops-wrapper/test/health-service.test.ts
career-ops-wrapper/test/script-readiness.test.ts
career-ops-wrapper/test/workspace-health.test.ts
career-ops-wrapper/fixtures/workspaces/
career-ops-wrapper/README.md
```

If implementation chooses `src/workspace/script-readiness.ts` instead of `career-ops-engine/script-readiness.ts`, keep the same responsibility and document the reason in Dev Agent Record. Do not put this logic in route handlers.

### Previous Story Intelligence

Use these lessons from Story 1.2:

- Do not expose future capabilities as ready. `scan`, `reports`, and `artifacts` stayed false after review because endpoint families do not exist yet.
- Real Career Ops workspace layout uses `config/profile.yml`; tests were added for that layout. Preserve this.
- Health route must remain public with query strings in LAN mode.
- Redaction/startup logging must not leak workspace paths or local pairing tokens.
- CLI parsing rejects missing values; do not regress config tests.
- Path guards reject traversal, absolute paths, Windows-style absolute paths, and symlink escape.
- Do not introduce `CAREER_OPS_SCAN_COMMAND` or any user-configurable shell command string.
- Current verified wrapper commands: `npm test`, `npm run build`; repo-level Android regression: `./gradlew test`.

### Testing Requirements

Use Vitest for wrapper tests. Tests must be deterministic and must not run real Career Ops scan or AI CLI commands.

Minimum test groups:

- Zod schema tests for new health readiness fields.
- Contract example tests for `health.ready.json` and `health.not-ready.json`.
- Script readiness tests for present/missing/unreadable-if-portable `doctor.mjs`, `scan.mjs`, and `portals.yml`.
- Health service aggregation tests for ready workspace + ready scripts, ready workspace + missing scan script, invalid workspace + present scripts.
- Route tests for `GET /api/v1/health` shape and public LAN query-string access.
- Regression tests that no `/run`, `/exec`, `/command`, or generic command body endpoint exists.

Run:

```bash
cd career-ops-wrapper && npm test
cd career-ops-wrapper && npm run build
./gradlew test
```

### Latest Technical Notes

- Node `child_process.spawn()` starts child processes asynchronously without blocking the event loop, and its options include `cwd`/`env`; future scan execution stories should use these fixed options for the local script runner rather than shell strings. Source: [Node.js child_process docs](https://nodejs.org/api/child_process.html).
- Node `fs.access` checks file/directory permissions using constants such as `F_OK`, `R_OK`, and `W_OK`; use `node:fs` constants rather than deprecated direct constants. Source: [Node.js fs docs](https://nodejs.org/api/fs.html).
- Story 1.3 should only check file presence/readability; process spawning belongs to Epic 4 scan-run stories.

### Project Structure Notes

The existing Android project remains untouched in this story. All implementation belongs under `career-ops-wrapper/` except story and sprint-status updates.

No `project-context.md` was found during story creation. Use PRD, Architecture, Epics, Correct Course proposal, Story 1.2, and current wrapper scaffold as source of truth.

## References

- [Epics Story 1.3](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/epics.md:243)
- [Epics Additional Requirements](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/epics.md:84)
- [Epics Story 4.1 Local Script Runner](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/epics.md:856)
- [Architecture Startup Boundary](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md:105)
- [Architecture Command Allowlist](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md:118)
- [Architecture Key Assumptions](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md:151)
- [Architecture Pattern Examples](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md:740)
- [Correct Course Script Runner Proposal](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-21-career-ops-script-runner.md:1)
- [Story 1.2 Previous Implementation](/Users/dthuy/Workspace/task-arena/_bmad-output/implementation-artifacts/1-2-validate-wrapper-runtime-configuration-and-workspace-boundary.md:1)
- [Node.js child_process](https://nodejs.org/api/child_process.html)
- [Node.js fs](https://nodejs.org/api/fs.html)

## Change Log

- 2026-06-21: Created Story 1.3 with health/readiness, local script runner readiness, zero-token scan path, and contract context.
- 2026-06-21: Implemented Story 1.3 health/readiness contract, local script readiness checks, examples, fixtures, and tests.
- 2026-06-21: Addressed code review findings and marked Story 1.3 done.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Red phase: `npm test` failed as expected before implementation because `src/career-ops-engine/script-readiness.ts`, `apiVersion`, `careerOps`, and workspace messages did not exist yet.
- Green/refactor phase: `npm test` passed with 11 test files and 79 tests.
- Build validation: `npm run build` passed in `career-ops-wrapper`.
- Repo regression: `./gradlew test` passed.
- Review patch validation: `npm test` passed with 11 test files and 86 tests.
- Review patch build validation: `npm run build` passed in `career-ops-wrapper`.
- Review patch repo regression: `./gradlew test` passed.

### Implementation Plan

- Extend the existing health contract instead of adding a parallel endpoint.
- Add a focused `career-ops-engine/script-readiness.ts` module that checks fixed local Career Ops prerequisites without executing scripts.
- Keep `HealthService` as the aggregation boundary for workspace readiness, Career Ops readiness, and API capabilities.
- Update contract examples and README so Android can distinguish readiness from implemented API capabilities.

### Completion Notes List

- Story created after Correct Course clarified that MVP scan readiness should target the local zero-token script runner, not AI CLI or provider API-key workflows.
- Dev implementation must extend existing health service/contract paths from Stories 1.1 and 1.2 rather than creating parallel endpoints.
- Added additive Health DTO fields: `apiVersion`, `workspace.messages`, and `careerOps` local script runner readiness.
- Added deterministic script readiness checks for `doctor.mjs`, `scan.mjs`, and `portals.yml`; checks only file existence/readability and never execute scripts or AI CLIs.
- Updated health aggregation so top-level `status` is `ready` only when both workspace and local script readiness are ready.
- Preserved `capabilities.scan`, `capabilities.reports`, and `capabilities.artifacts` as `false` until endpoint families exist.
- Updated contract examples, README, and fixture workspaces for valid/missing script readiness cases.
- Verified with `npm test`, `npm run build`, and `./gradlew test`.
- Resolved review findings by requiring readiness prerequisites and workspace source files to be readable regular files within the workspace boundary.
- Aligned portal config handling so both workspace health and script readiness support `portals.yml` and `portals.yaml`.
- Preserved listability failures as `workspace-listable` instead of collapsing every read-dir failure into `career-ops-structure`.
- Hardened health route tests to close Fastify servers in `finally` blocks.

### File List

- _bmad-output/implementation-artifacts/1-3-expose-health-and-workspace-readiness-api.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- career-ops-wrapper/README.md
- career-ops-wrapper/contracts/examples/health.not-ready.json
- career-ops-wrapper/contracts/examples/health.ready.json
- career-ops-wrapper/fixtures/workspaces/missing-doctor-script/config/profile.yml
- career-ops-wrapper/fixtures/workspaces/missing-doctor-script/cv.md
- career-ops-wrapper/fixtures/workspaces/missing-doctor-script/portals.yml
- career-ops-wrapper/fixtures/workspaces/missing-doctor-script/scan.mjs
- career-ops-wrapper/fixtures/workspaces/missing-portals-yml/config/profile.yml
- career-ops-wrapper/fixtures/workspaces/missing-portals-yml/cv.md
- career-ops-wrapper/fixtures/workspaces/missing-portals-yml/doctor.mjs
- career-ops-wrapper/fixtures/workspaces/missing-portals-yml/scan.mjs
- career-ops-wrapper/fixtures/workspaces/missing-scan-script/config/profile.yml
- career-ops-wrapper/fixtures/workspaces/missing-scan-script/cv.md
- career-ops-wrapper/fixtures/workspaces/missing-scan-script/doctor.mjs
- career-ops-wrapper/fixtures/workspaces/missing-scan-script/portals.yml
- career-ops-wrapper/fixtures/workspaces/valid-career-ops-config-profile/doctor.mjs
- career-ops-wrapper/fixtures/workspaces/valid-career-ops-config-profile/scan.mjs
- career-ops-wrapper/fixtures/workspaces/valid-career-ops/doctor.mjs
- career-ops-wrapper/fixtures/workspaces/valid-career-ops/scan.mjs
- career-ops-wrapper/src/career-ops-engine/script-readiness.ts
- career-ops-wrapper/src/contracts/health-contract.ts
- career-ops-wrapper/src/services/health-service.ts
- career-ops-wrapper/src/workspace/workspace-health.ts
- career-ops-wrapper/test/contract-examples.test.ts
- career-ops-wrapper/test/health-route.test.ts
- career-ops-wrapper/test/health-service.test.ts
- career-ops-wrapper/test/script-readiness.test.ts
- career-ops-wrapper/test/workspace-health.test.ts
