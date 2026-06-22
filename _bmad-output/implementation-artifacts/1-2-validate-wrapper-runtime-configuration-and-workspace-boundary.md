---
created: 2026-06-21
story_key: 1-2-validate-wrapper-runtime-configuration-and-workspace-boundary
owner: Codex
baseline_commit: f52d54296ca205fef486f4213781ceabebdefa82
---

# Story 1.2: Validate Wrapper Runtime Configuration and Workspace Boundary

Status: done

Owner: Codex

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a personal mobile app user,
I want the Wrapper Backend to know which Career Ops Workspace it is allowed to use,
so that mobile actions read and write only the intended local workspace.

## Acceptance Criteria

1. Given the Wrapper Backend starts, when runtime configuration is loaded, then configuration is resolved in this order: CLI flags, `.env` fallback, safe defaults, and the workspace location can be provided by running inside a Career Ops Workspace or by passing `--workspace /path/to/career-ops`.
2. Given the Wrapper Backend has resolved a workspace location, when workspace validation runs, then the backend reports whether the workspace path exists, is readable, is writable where needed, and appears to contain the expected Career Ops structure, and the Android app never receives or stores the absolute local workspace path.
3. Given an API request attempts to access a file, when the requested path contains traversal patterns, symlinks, absolute paths, or output IDs that resolve outside the configured workspace, then the backend rejects the request with a typed error, and no file outside the Career Ops Workspace is read, written, downloaded, or served.
4. Given the Wrapper Backend is reachable from LAN or private network mode, when a request is made to protected API routes, then the backend requires `X-Career-Ops-Token: <token>` according to runtime security settings, and invalid or missing tokens return a typed unauthorized error without leaking workspace details.
5. Given backend logs are written during configuration or validation failures, when logs are inspected, then they do not include full CV content, profile content, secrets, local pairing tokens, or unnecessary absolute workspace file contents.

## Tasks / Subtasks

- [x] Tighten runtime configuration loading. (AC: 1, 4)
  - [x] Extend `CliArgs` and `RuntimeConfig` so CLI flags override env fallback and safe defaults without introducing any free-form command config.
  - [x] Support workspace from `--workspace`; when omitted, attempt current working directory as the workspace candidate.
  - [x] Use `CAREER_OPS_PAIRING_TOKEN` as the only wrapper token env name.
  - [x] Preserve default host `127.0.0.1` and default port `3000`.
  - [x] Treat LAN/private binding as any host that is not localhost loopback; require a non-empty Local Pairing Token for protected routes in that mode.

- [x] Implement workspace validation and health summary. (AC: 1, 2, 5)
  - [x] Add `src/workspace/workspace-paths.ts` to resolve the configured workspace path without exposing it in DTOs.
  - [x] Add `src/workspace/workspace-health.ts` behavior that checks existence, directory type, readable access, writable access, and expected Career Ops structure signals.
  - [x] Represent validation results through the existing `WorkspaceHealthDto` without absolute paths in `missingRequirements`, messages, error details, or contract examples.
  - [x] Update `HealthService` so `/api/v1/health` reports real workspace readiness from runtime config instead of scaffold `unknown` only.
  - [x] Keep Career Ops version detection optional; return `careerOpsVersion: null` until a reliable upstream version source exists.

- [x] Implement workspace path containment utilities. (AC: 3, 5)
  - [x] Add `src/security/path-guard.ts` or `src/workspace/workspace-paths.ts` helpers for resolving relative workspace paths.
  - [x] Reject absolute API path input, `..` traversal, empty path segments that escape intent, and paths whose resolved/real path is outside the workspace.
  - [x] Use `PATH_OUTSIDE_WORKSPACE` for containment failures.
  - [x] Do not wire CV/Profile/Portal reads yet; provide reusable utilities and tests for later stories.
  - [x] Ensure thrown errors and logs redact absolute workspace paths.

- [x] Implement Local Pairing Token request guard. (AC: 4, 5)
  - [x] Add `src/security/local-pairing-token.ts` to validate `X-Career-Ops-Token`.
  - [x] Add a Fastify request hook or route-level guard that protects all non-health `/api/v1` routes when LAN/private token enforcement is enabled.
  - [x] Leave `GET /api/v1/health` reachable without token so Android can diagnose setup.
  - [x] Return stable `UNAUTHORIZED` errors for missing or invalid tokens without leaking configured token, workspace path, or host details.
  - [x] Do not introduce accounts, Firebase App Check, token rotation, device registry, or backend database storage.

- [x] Expand redaction and docs for the new security boundary. (AC: 4, 5)
  - [x] Redact `X-Career-Ops-Token` values, `CAREER_OPS_PAIRING_TOKEN=...`, and common absolute workspace path strings before logging or returning diagnostics.
  - [x] Update `career-ops-wrapper/.env.example` and `career-ops-wrapper/README.md` with workspace, host, port, and Local Pairing Token examples.
  - [x] Explicitly document that Local Pairing Token is not user auth and that Firebase App Check is non-MVP/deferred.

- [x] Add fixture workspace coverage. (AC: 1, 2, 3)
  - [x] Create minimal fixture workspaces under `career-ops-wrapper/fixtures/workspaces/` for valid, missing/invalid, unwritable-or-readonly-if-portable, and traversal cases.
  - [x] Keep fixtures small and deterministic; no real Career Ops process should run in this story.
  - [x] Record expected health behavior in tests rather than relying on machine-specific absolute paths.

- [x] Author tests before implementation and keep them green. (AC: 1-5)
  - [x] Add config tests proving CLI overrides env, env overrides defaults, current working directory fallback is supported, and LAN mode requires configured token behavior.
  - [x] Add workspace validation tests for valid workspace, missing workspace, invalid structure, readable/writable checks where portable, and no absolute path leakage.
  - [x] Add path guard tests for traversal, absolute paths, symlink escape, and valid in-workspace relative paths.
  - [x] Add Fastify inject tests for protected non-health routes with missing, invalid, and valid `X-Career-Ops-Token` when LAN/private mode is enabled.
  - [x] Add redaction tests for token and local path patterns.
  - [x] Run `npm test` and `npm run build` in `career-ops-wrapper`.

### Review Findings

- [x] [Review][Patch] CLI flags with missing values are silently accepted or misparsed [career-ops-wrapper/src/config/cli-args.ts:28]
- [x] [Review][Patch] Workspace health can mark unrelated projects ready from a single weak structure signal [career-ops-wrapper/src/workspace/workspace-health.ts:15]
- [x] [Review][Patch] Health capabilities advertise unimplemented scan/report/artifact surfaces as ready [career-ops-wrapper/src/services/health-service.ts:17]
- [x] [Review][Patch] Path guard leaks raw filesystem errors from `realpath` instead of typed boundary errors [career-ops-wrapper/src/security/path-guard.ts:12]
- [x] [Review][Patch] Path guard does not reject Windows-style absolute paths on POSIX hosts [career-ops-wrapper/src/security/path-guard.ts:27]
- [x] [Review][Patch] LAN health exemption fails for health requests with query strings [career-ops-wrapper/src/security/local-pairing-token.ts:29]
- [x] [Review][Patch] Local Pairing Token guard accepts ambiguous duplicate or comma-joined token headers [career-ops-wrapper/src/security/local-pairing-token.ts:38]
- [x] [Review][Patch] Workspace write probe uses timestamp filenames and can collide or leave probe files behind [career-ops-wrapper/src/workspace/workspace-health.ts:74]
- [x] [Review][Patch] Redaction is incomplete and startup error logging bypasses it [career-ops-wrapper/src/security/redaction.ts:7]
- [x] [Review][Defer] Future file APIs need validate-and-open helpers to avoid symlink time-of-check/time-of-use races [career-ops-wrapper/src/security/path-guard.ts:12] — deferred, future file adapters are not implemented in Story 1.2

## Dev Notes

### Scope Boundary

This story is the backend safety and configuration foundation for future file APIs. It must not implement CV/Profile/Portal read-write endpoints, scan execution, report/artifact serving, Android UI, Android flavors, Room cache, or real Career Ops process execution.

The outcome is a tested wrapper boundary that can answer: "Which workspace may this server touch, is it ready enough for later stories, and are LAN/private requests protected?"

### Runtime Configuration Requirements

Runtime configuration must preserve the architecture order:

1. CLI flags.
2. `.env` fallback.
3. safe defaults.

Current files to extend:

- `career-ops-wrapper/src/config/cli-args.ts`
- `career-ops-wrapper/src/config/env.ts`
- `career-ops-wrapper/src/config/runtime-config.ts`

Required settings:

- `host`: default `127.0.0.1`
- `port`: default `3000`
- `workspace`: `--workspace` first; if omitted, candidate is current working directory
- `pairingToken`: env only through `CAREER_OPS_PAIRING_TOKEN`

Do not add `CAREER_OPS_SCAN_COMMAND`, generic command path configuration, or user-configurable shell command strings. Scan execution remains future work through typed `career-ops-engine.runScan()`.

### Local Pairing Token Rules

Use the approved Correct Course terminology:

- Concept name: Local Pairing Token
- Env name: `CAREER_OPS_PAIRING_TOKEN`
- Header name: `X-Career-Ops-Token`
- Localhost mode may omit token.
- LAN/private mode requires token for protected non-health routes.
- `GET /api/v1/health` remains unprotected for setup diagnosis.
- This is not account authentication, not Firebase App Check, and not a public API key.

Implementation hint: keep the guard minimal. A Fastify hook is appropriate because Fastify officially supports request/reply lifecycle hooks registered with `fastify.addHook`; register the guard before protected routes are used. Do not install auth plugins for this MVP unless a later story explicitly promotes one.

### Workspace Validation Requirements

The wrapper must resolve a single allowed workspace root and keep absolute paths server-side only.

Validation should check:

- candidate path exists
- candidate path is a directory
- process can read it
- process can write where needed, or can at least report write failure explicitly
- candidate appears to contain Career Ops structure

Career Ops structure detection can be conservative in this story. The exact upstream layout may evolve, so implement named checks that report missing requirements without claiming Android can repair them. Do not hard-code private machine paths in tests or DTOs.

Suggested minimal readiness signals:

- package or project marker if present
- known workspace directories/files when present
- future CV/Profile/Portal expected locations as missing requirements, not fatal crashes

If the repository cannot reliably identify a full Career Ops sample workspace yet, return `workspace.status: "invalid"` with safe `missingRequirements` such as `["career-ops-structure"]`.

### Workspace Path Guard Requirements

All future file APIs must use this story's containment helpers. The helper should:

- accept only workspace-relative logical paths or opaque IDs resolved by backend indexes in later stories
- reject raw absolute input from APIs
- reject traversal attempts such as `../secrets`
- resolve symlinks with real path checks before read/write/serve
- verify the final path remains inside the real workspace root
- throw `ApiError("PATH_OUTSIDE_WORKSPACE", ...)` on failure

Node official docs define `fs` as the stable file-system API and `fs.realpath`/`fs.promises.realpath` as the API for resolving real paths. Node `path.relative()` returns the path from one absolute path to another and is useful for checking whether a resolved target escapes the workspace. Use Node built-ins, not a new dependency, for this story.

### Health Integration

Story 1.1 currently returns scaffold workspace health through:

- `career-ops-wrapper/src/workspace/workspace-health.ts`
- `career-ops-wrapper/src/services/health-service.ts`
- `career-ops-wrapper/src/api/health-routes.ts`

Update these instead of creating a parallel health path. The Health DTO shape from Story 1.1 remains the contract. Android must never receive the absolute workspace path.

### Error and Redaction Requirements

Use existing error infrastructure:

- `ApiError`
- `ErrorCodeSchema`
- `mapErrorToResponse`
- existing `UNAUTHORIZED` and `PATH_OUTSIDE_WORKSPACE` codes

Do not add new error codes unless the existing taxonomy cannot express a required condition. Error `details` must not include CV content, token values, or local absolute paths.

Extend existing redaction in:

- `career-ops-wrapper/src/security/redaction.ts`

Redaction should cover:

- `X-Career-Ops-Token: ...`
- `CAREER_OPS_PAIRING_TOKEN=...`
- obvious local workspace paths from diagnostics

### File Structure Requirements

Expected files to create or modify:

```text
career-ops-wrapper/src/config/cli-args.ts
career-ops-wrapper/src/config/env.ts
career-ops-wrapper/src/config/runtime-config.ts
career-ops-wrapper/src/server.ts
career-ops-wrapper/src/services/health-service.ts
career-ops-wrapper/src/workspace/workspace-health.ts
career-ops-wrapper/src/workspace/workspace-paths.ts
career-ops-wrapper/src/security/local-pairing-token.ts
career-ops-wrapper/src/security/path-guard.ts
career-ops-wrapper/src/security/redaction.ts
career-ops-wrapper/test/config.test.ts
career-ops-wrapper/test/workspace-health.test.ts
career-ops-wrapper/test/path-guard.test.ts
career-ops-wrapper/test/local-pairing-token.test.ts
career-ops-wrapper/test/redaction.test.ts
career-ops-wrapper/fixtures/workspaces/
career-ops-wrapper/.env.example
career-ops-wrapper/README.md
```

If implementation finds a cleaner split, keep the same responsibilities and document the final file list in the Dev Agent Record.

### Previous Story Intelligence

Story 1.1 created the backend scaffold and established these patterns:

- Fastify app creation lives in `src/server.ts`.
- `/api/v1` route registration lives in `src/api/register-routes.ts`.
- Route files must remain HTTP mapping only.
- Health orchestration belongs in `src/services/health-service.ts`.
- Zod contracts are checked through examples in `contracts/examples/`.
- Error mapping is centralized in `src/errors/error-mapper.ts`.
- Do not expose `/run`, `/exec`, `/command`, or any generic command endpoint.
- Current verified commands: `npm test`, `npm run build`, and repo-level `./gradlew test`.

Story 1.1 review findings already fixed strict port parsing, ApiError status mapping, and contract test CWD assumptions. Do not regress those fixes.

### Testing Requirements

Use Vitest. Tests should be deterministic and not require a real installed Career Ops CLI.

Minimum test groups:

- config precedence and validation
- workspace validation
- path containment
- Local Pairing Token request guard
- redaction
- Fastify health behavior

Keep symlink escape tests portable. If the filesystem or platform does not support symlinks in a test environment, write the test so it skips only that specific symlink assertion while still covering normal traversal and absolute path rejection.

### Latest Technical Notes

- Fastify v5 lifecycle hooks are registered with `fastify.addHook` and can run during request/reply lifecycle stages; use a hook for shared token enforcement instead of repeating token checks in route handlers. Source: [Fastify Hooks](https://fastify.io/docs/latest/Reference/Hooks/).
- Node `fs` is the stable built-in filesystem API; use `node:fs/promises` for async access and `realpath` where symlink resolution matters. Source: [Node.js fs docs](https://nodejs.org/api/fs.html).
- Node `path.relative()` returns the relative path between resolved absolute paths and can help detect when a target escapes a workspace root. Source: [Node.js path docs](https://nodejs.org/api/path.html).

### Project Structure Notes

The existing Android project remains untouched in this story. All implementation belongs under `career-ops-wrapper/` except story and sprint-status updates.

No `project-context.md` was found during story creation, so this story relies on PRD, Addendum, Architecture, Epics, Story 1.1, and current wrapper scaffold as its source of truth.

## References

- [Epics Story 1.2](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/epics.md:209)
- [Epics NFR3/NFR6](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/epics.md:64)
- [Epics LAN Token Requirement](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/epics.md:109)
- [Architecture Security Requirements](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md:361)
- [Architecture API Header Convention](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md:539)
- [Architecture Workspace Boundary](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md:114)
- [Architecture File Safety Flow](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md:347)
- [PRD NFR3/NFR6](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/prd.md:453)
- [PRD Connection Modes](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/prd.md:174)
- [Story 1.1 Previous Implementation](/Users/dthuy/Workspace/task-arena/_bmad-output/implementation-artifacts/1-1-scaffold-wrapper-backend-api-foundation.md:1)
- [Fastify Hooks](https://fastify.io/docs/latest/Reference/Hooks/)
- [Node.js fs](https://nodejs.org/api/fs.html)
- [Node.js path](https://nodejs.org/api/path.html)

## Change Log

- 2026-06-21: Created Story 1.2 with full runtime config, workspace boundary, Local Pairing Token, redaction, and test context.
- 2026-06-21: Implemented runtime configuration, workspace validation, path containment, Local Pairing Token guard, docs, fixtures, and tests.
- 2026-06-21: Addressed code review patch findings and moved story to done.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `cd career-ops-wrapper && npm test` initially failed as expected in red phase for missing guard/path/health behavior.
- `cd career-ops-wrapper && npm test` passed: 8 test files, 54 tests.
- `cd career-ops-wrapper && npm run build` passed.
- `./gradlew test` passed.
- Code review produced 9 patch findings, 1 deferred follow-up, and 3 dismissed findings.
- After review patches: `cd career-ops-wrapper && npm test` passed: 10 test files, 66 tests.
- After review patches: `cd career-ops-wrapper && npm run build` passed.
- After review patches: `./gradlew test` passed.
- Real workspace verification: `/Users/dthuy/Workspace/career-ops` initially reported `career-ops-structure` missing because Career Ops stores profile at `config/profile.yml`; detection was updated and `GET /api/v1/health` returned `status: ready`.
- After real workspace layout patch: `cd career-ops-wrapper && npm test` passed: 10 test files, 67 tests.
- After real workspace layout patch: `cd career-ops-wrapper && npm run build` passed.

### Completion Notes List

- Story created by create-story workflow after Correct Course updated token terminology to Local Pairing Token.
- Dev implementation must start with tests and keep Story 1.1 scaffold patterns intact.
- Runtime config now supports CLI/env/default precedence, `--workspace`, cwd workspace fallback, and `CAREER_OPS_PAIRING_TOKEN` only.
- Health now validates the resolved workspace server-side and reports safe readiness without exposing absolute workspace paths to Android.
- Added reusable realpath-based containment utilities for future file APIs; unsafe paths throw `PATH_OUTSIDE_WORKSPACE`.
- Added Local Pairing Token guard for non-health `/api/v1` routes in LAN/private mode, while leaving localhost and health setup diagnostics usable.
- Expanded redaction/docs and fixtures; no scan execution, CV/Profile/Portal endpoints, auth accounts, Firebase App Check, or database storage were introduced.
- Resolved review findings by tightening CLI parsing, workspace structure detection, future capability flags, typed path errors, Windows path rejection, health query exemption, token header ambiguity, write probes, and startup/redaction behavior.
- Verified against the real `npx @santifer/career-ops init` workspace layout and added support for `config/profile.yml`.

### File List

- _bmad-output/implementation-artifacts/1-2-validate-wrapper-runtime-configuration-and-workspace-boundary.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- career-ops-wrapper/.env.example
- career-ops-wrapper/README.md
- career-ops-wrapper/fixtures/workspaces/invalid-structure/.gitkeep
- career-ops-wrapper/fixtures/workspaces/readonly-if-portable/package.json
- career-ops-wrapper/fixtures/workspaces/valid-career-ops/cv.md
- career-ops-wrapper/fixtures/workspaces/valid-career-ops/outputs/.gitkeep
- career-ops-wrapper/fixtures/workspaces/valid-career-ops/package.json
- career-ops-wrapper/fixtures/workspaces/valid-career-ops/portals.yml
- career-ops-wrapper/fixtures/workspaces/valid-career-ops/profile.yml
- career-ops-wrapper/fixtures/workspaces/valid-career-ops-config-profile/config/profile.yml
- career-ops-wrapper/fixtures/workspaces/valid-career-ops-config-profile/cv.md
- career-ops-wrapper/fixtures/workspaces/valid-career-ops-config-profile/portals.yml
- career-ops-wrapper/src/api/health-routes.ts
- career-ops-wrapper/src/api/register-routes.ts
- career-ops-wrapper/src/config/runtime-config.ts
- career-ops-wrapper/src/security/local-pairing-token.ts
- career-ops-wrapper/src/security/path-guard.ts
- career-ops-wrapper/src/security/redaction.ts
- career-ops-wrapper/src/server.ts
- career-ops-wrapper/src/services/health-service.ts
- career-ops-wrapper/src/workspace/workspace-health.ts
- career-ops-wrapper/src/workspace/workspace-paths.ts
- career-ops-wrapper/test/config.test.ts
- career-ops-wrapper/test/health-service.test.ts
- career-ops-wrapper/test/local-pairing-token.test.ts
- career-ops-wrapper/test/path-guard.test.ts
- career-ops-wrapper/test/redaction.test.ts
- career-ops-wrapper/test/server-logging.test.ts
- career-ops-wrapper/test/workspace-health.test.ts
