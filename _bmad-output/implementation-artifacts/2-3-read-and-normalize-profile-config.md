---
created: 2026-06-25
story_key: 2-3-read-and-normalize-profile-config
owner: Codex
baseline_commit: 0a383393122068fdf0b048c2b365d46677e5b6f1
---

# Story 2.3: Read and Normalize Profile Config

Status: done

<!-- Backend only. Read-only profile config foundation. Do not touch Android and do not implement profile save in this story. -->

## Story

As a personal mobile app user,
I want the Wrapper Backend to load my Career Ops Profile Config as normalized MVP fields,
so that Android can render job-search preferences without reading or understanding Career Ops YAML files directly.

## Acceptance Criteria

1. Given the Wrapper Backend is connected to a valid Career Ops Workspace, when `GET /api/v1/profile` is called, then the backend reads only the supported profile config file inside the workspace and returns a normalized `ProfileDto`.
2. Given the workspace has either `config/profile.yml`, `config/profile.yaml`, `profile.yml`, or `profile.yaml`, when profile read runs, then the backend picks the first existing readable regular file in that order and rejects symlinks or paths resolving outside the workspace.
3. Given the upstream Profile Config contains fields outside the MVP editing surface, when the backend normalizes the config, then the response includes only supported `ProfileDto` fields and the source file is not rewritten, repaired, or stripped.
4. Given the Profile Config exists and is valid, when `GET /api/v1/profile` is called, then the response validates against checked-in `ProfileDto` schema/examples and includes `sourceRevision` plus optional `updatedAt`.
5. Given the Profile Config is missing or unreadable, when `GET /api/v1/profile` is called, then the backend returns a typed `NOT_FOUND` or `WORKSPACE_UNHEALTHY` response without exposing local absolute paths.
6. Given the Profile Config YAML is malformed or cannot be normalized into required MVP fields, when profile read runs, then the backend returns typed `VALIDATION_ERROR` and does not modify the existing file.
7. Given backend logs/errors are inspected, when profile read succeeds or fails, then no full profile content, secrets, local pairing token, or local absolute path is exposed.
8. Given backend validation runs, when this story is complete, then focused profile contract, fixture, service/adapter, route, OpenAPI, and regression tests pass with `npm test` and `npm run build` from `career-ops-wrapper`.

## Tasks / Subtasks

- [x] Add profile contract and examples. (AC: 1, 3, 4, 6, 8)
  - [x] RED: add failing contract/example tests for a valid `ProfileDto`, profile missing error, and profile validation error.
  - [x] Add `career-ops-wrapper/src/contracts/profile-contract.ts` with `ProfileDtoSchema`.
  - [x] Export profile schema/type from `career-ops-wrapper/src/contracts/index.ts`.
  - [x] Add checked-in examples under `career-ops-wrapper/contracts/examples/`, including `profile.valid.json` and any missing profile-specific error example needed by tests.

- [x] Add fixed profile file read adapter. (AC: 1, 2, 3, 5, 6, 7, 8)
  - [x] RED: add failing adapter tests for `config/profile.yml`, root `profile.yml`, missing profile file, malformed YAML, invalid required fields, unsupported unknown fields, and symlink/out-of-workspace rejection.
  - [x] Add `career-ops-wrapper/src/workspace/profile-file-adapter.ts`.
  - [x] Reuse `resolveWorkspaceRoot()` and `isInsidePath()` from `workspace/workspace-paths.ts`.
  - [x] Use `node:fs/promises` for file access and the existing `js-yaml` dependency for YAML parsing.
  - [x] Do not write, repair, create, or back up profile files in this story.

- [x] Add profile normalization service. (AC: 1, 3, 4, 6, 7, 8)
  - [x] RED: add failing service tests for real Career Ops profile YAML shape and normalized `ProfileDto` output.
  - [x] Add `career-ops-wrapper/src/services/profile-service.ts`.
  - [x] Normalize only MVP fields; do not expose raw YAML or unknown upstream fields in the API response.
  - [x] Include `sourceRevision` as an opaque hash prefix and `updatedAt` from file mtime where available.

- [x] Add protected profile read route under `/api/v1`. (AC: 1, 4, 5, 6, 7, 8)
  - [x] RED: add Fastify injection tests for `GET /api/v1/profile`, missing profile, malformed profile, and LAN/private token protection inherited from the existing guard.
  - [x] Add `career-ops-wrapper/src/api/profile-routes.ts`.
  - [x] Register profile routes from `career-ops-wrapper/src/api/register-routes.ts` using the existing `/api/v1` prefix.
  - [x] Keep routes as HTTP mapping only: call `ProfileService`, parse response DTO, return it. No filesystem or YAML parsing in route handlers.

- [x] Update OpenAPI for the implemented profile read surface only. (AC: 4, 5, 6, 8)
  - [x] RED: update OpenAPI tests to expect `/api/v1/profile`, `ProfileDto`, profile examples, and typed error responses.
  - [x] Update `career-ops-wrapper/src/openapi/openapi-document.ts` using existing `z.toJSONSchema()` conversion.
  - [x] Document `GET /api/v1/profile`; do not document `PUT /profile` until Story 2.4.

- [x] Run validation and close story tasks. (AC: 8)
  - [x] Run focused tests during TDD after each behavior turns green.
  - [x] Run `npm test` from `career-ops-wrapper`.
  - [x] Run `npm run build` from `career-ops-wrapper`.
  - [x] Update this story's Dev Agent Record, File List, and task checkboxes only after all validation passes.

### Review Findings

- [x] [Review][Patch] Map all existing profile file read failures to typed workspace errors [career-ops-wrapper/src/workspace/profile-file-adapter.ts:55]
- [x] [Review][Patch] Catch profile file stat/read races instead of leaking raw fs errors as 500 [career-ops-wrapper/src/workspace/profile-file-adapter.ts:87]
- [x] [Review][Patch] Document profile path-boundary rejection response in OpenAPI [career-ops-wrapper/src/openapi/openapi-document.ts:316]
- [x] [Review][Patch] Enforce opaque profile sourceRevision format in ProfileDto schema [career-ops-wrapper/src/contracts/profile-contract.ts:17]
- [x] [Review][Patch] Reject malformed required profile string arrays instead of silently dropping invalid entries [career-ops-wrapper/src/services/profile-service.ts:182]

## Dev Notes

### Scope Boundaries

- Backend only. Do not touch `android/`.
- This story is read-only profile config. Do not implement `PUT /profile`, save/backup behavior, profile editing UI, Room cache, scan readiness, portal config, offers, reports, artifacts, or generic YAML file management.
- The API must not accept user-provided file paths, filenames, commands, upload format flags, or workspace paths.
- Unknown upstream Profile Config fields are preserved by not rewriting the source file. Merge-preserving writes belong to Story 2.4.

### Current Backend Patterns to Reuse

- `career-ops-wrapper/src/server.ts` creates Fastify, sets the shared `mapErrorToResponse()` handler, registers docs, then registers API routes.
- `career-ops-wrapper/src/api/register-routes.ts` mounts routes under `/api/v1` and installs `registerLocalPairingTokenGuard()`.
- `career-ops-wrapper/src/api/cv-routes.ts` shows the current protected resource route pattern.
- `career-ops-wrapper/src/services/cv-service.ts` shows the service orchestration pattern.
- `career-ops-wrapper/src/workspace/cv-file-adapter.ts` shows fixed-file workspace read, realpath containment, typed missing/unhealthy errors, mtime metadata, and hash-derived `sourceRevision`.
- `career-ops-wrapper/src/contracts/index.ts` re-exports contract modules.
- `career-ops-wrapper/src/openapi/openapi-document.ts` is the only OpenAPI generator; extend it rather than adding another package.
- Error responses use existing `ApiError` codes and the stable `{ error: { code, message, details? } }` envelope.

### Profile DTO Requirements

`ProfileDto` follows the architecture MVP schema:

```ts
{
  targetRoles: string[];
  seniorityLevel: string;
  preferredLocations: string[];
  remotePreference: "remote" | "hybrid" | "onsite" | "flexible" | "unknown";
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  workAuthorizationNote?: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  excludedKeywords: string[];
  positioningSummary?: string;
  sourceRevision?: string;
  updatedAt?: string | null;
}
```

Validation:

- `targetRoles`, `seniorityLevel`, and `preferredLocations` are required and non-empty.
- `remotePreference` enum is required; use `unknown` only when the source does not clearly indicate remote, hybrid, onsite, or flexible.
- `salaryMin` and `salaryMax` are optional non-negative integers. If both exist, `salaryMax >= salaryMin`.
- `salaryCurrency` is required when either salary bound exists and must match `/^[A-Z]{3}$/`.
- Optional arrays default to `[]` in normalized responses.
- `positioningSummary` is optional, non-empty when present, and max 2000 chars.
- `sourceRevision` must not reveal filesystem paths. A SHA-256 hash prefix of the raw profile YAML is enough.
- Success responses return `ProfileDto` directly. Do not wrap success in `{ success, data }`.

### Normalization Mapping

Use the real Career Ops profile shape from `/Users/dthuy/Workspace/career-ops/config/profile.yml` and `config/profile.example.yml` as the implementation guide. Minimal mapping:

- `targetRoles`: `target_roles.primary` string array.
- `seniorityLevel`: first non-empty `target_roles.archetypes[].level`; if absent, derive a non-empty value from role text only if unambiguous, otherwise validation fails.
- `preferredLocations`: combine non-empty `location.city`, `location.country`, and `compensation.location_flexibility` into user-facing location strings without duplicates.
- `remotePreference`: normalize from `compensation.location_flexibility`; if it contains multiple modes such as remote plus hybrid/onsite, return `flexible`.
- `salaryCurrency`: uppercase `compensation.currency` when salary bounds are emitted.
- `salaryMin`: parse `compensation.minimum` only when it is a clear non-negative amount. Support simple `20M VND` style by converting `M` to millions.
- `salaryMax`: parse the upper bound of `compensation.target_range` only when it is clear, such as `25M - 45M VND`.
- `workAuthorizationNote`: `location.visa_status`.
- `mustHaveSkills`: `narrative.superpowers` string array.
- `niceToHaveSkills`: `[]` for this story unless a clear existing source field is present.
- `excludedKeywords`: `[]` for this story unless a clear existing source field is present.
- `positioningSummary`: prefer `narrative.headline`; append `narrative.exit_story` only if useful and the final string stays under 2000 chars.

Reject malformed YAML and missing required source fields with `VALIDATION_ERROR`. Do not silently invent required user data.

### Profile File Semantics

- Supported profile file search order: `config/profile.yml`, `config/profile.yaml`, `profile.yml`, `profile.yaml`.
- Reads must stay inside the configured Career Ops Workspace.
- Existing symlinks that resolve outside the workspace must be rejected.
- Directories named like profile files are invalid, not ready.
- Missing profile file maps to `NOT_FOUND`.
- Unreadable workspace or unreadable profile file maps to `WORKSPACE_UNHEALTHY`.
- Malformed YAML or unsupported structure maps to `VALIDATION_ERROR`.
- Do not log or return raw YAML, full profile content, secrets, token values, or local absolute paths.

### Testing Requirements

- Use Vitest. Follow strict TDD: write the failing test first and verify it fails before production code.
- Add/update tests in the existing flat `career-ops-wrapper/test/` style.
- Required focused coverage:
  - `ProfileDtoSchema` accepts a valid normalized example and rejects missing required fields, bad remote enum, bad salary ordering, and missing salary currency when salary bounds exist.
  - Checked-in profile examples parse with Zod.
  - Adapter reads both `config/profile.yml` and root `profile.yml`.
  - Unknown YAML fields do not leak into `ProfileDto` and the source YAML remains unchanged.
  - Missing, unreadable, malformed, directory, and out-of-workspace symlink cases map to typed errors.
  - `GET /api/v1/profile` returns valid DTO for fixture workspace and inherits Local Pairing Token protection in LAN/private mode.
  - Generic command endpoints remain 404; do not add `/run`, `/exec`, `/command`, or a generic config endpoint.
  - OpenAPI includes health, CV, and the implemented profile read endpoint only.

Minimum validation:

```bash
cd career-ops-wrapper
npm test
npm run build
```

### Project Structure Notes

Expected files to add:

- `career-ops-wrapper/src/contracts/profile-contract.ts`
- `career-ops-wrapper/src/api/profile-routes.ts`
- `career-ops-wrapper/src/services/profile-service.ts`
- `career-ops-wrapper/src/workspace/profile-file-adapter.ts`
- `career-ops-wrapper/contracts/examples/profile.valid.json`
- Profile-focused tests under `career-ops-wrapper/test/`

Expected files to update:

- `career-ops-wrapper/src/contracts/index.ts`
- `career-ops-wrapper/src/api/register-routes.ts`
- `career-ops-wrapper/src/openapi/openapi-document.ts`
- `career-ops-wrapper/test/openapi-document.test.ts`
- Existing contract/example tests as needed.

Potential dependency note:

- `js-yaml` is already installed as a runtime dependency. If TypeScript compilation requires package types, add only the smallest matching dev dependency for typings; do not replace the YAML parser.

### Previous Story Intelligence

- Story 2.1 implemented CV read/write and the shared safe-file foundation; do not duplicate CV contract, route, or file adapter behavior.
- Story 2.2 is marked done because its minimal CV write scope was intentionally covered by Story 2.1.
- Story 2.1 code review hardened symlink handling, parser/body-limit error mapping, concurrent CV save response correctness, invalid existing CV reads, and OpenAPI workspace-unhealthy responses. Preserve those patterns.
- Current worktree includes uncommitted 2.1 backend files. Treat them as current source, not as changes to revert.

### Latest Technical Notes

- Fastify 5 recommends schema-based validation, but this repo currently uses explicit Zod parsing and Zod-derived OpenAPI; keep that local pattern.
- Zod 4 first-party `z.toJSONSchema()` is already used in `openapi-document.ts`; do not add `zod-to-json-schema`.
- `js-yaml` is the installed YAML parser for profile/portal config adapters.
- Node `fs/promises` plus `realpath`/`stat`/`access` are enough for this read-only story; no new file abstraction is needed.

### References

- [Epic 2 Story 2.3](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/epics.md:472)
- [PRD MVP Profile Fields](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/prd.md:99)
- [Architecture ProfileDto](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/architecture.md:1406)
- [Architecture API Response Formats](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/architecture.md:608)
- [Architecture Backend Module Boundaries](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/architecture.md:994)
- [Project Context Backend Stack](/Users/dthuy/Workspace/jobflow/_bmad-output/project-context.md:31)
- [Story 2.1 Previous Implementation](/Users/dthuy/Workspace/jobflow/_bmad-output/implementation-artifacts/2-1-read-cv-markdown-from-career-ops-workspace.md)
- [Fastify Validation and Serialization](https://fastify.io/docs/latest/Reference/Validation-and-Serialization/)
- [Zod JSON Schema](https://zod.dev/json-schema)
- [js-yaml package](https://www.npmjs.com/package/js-yaml)

## Change Log

- 2026-06-25: Created backend-only read-profile story with normalization mapping and implementation guardrails.
- 2026-06-25: Implemented read-only profile contract, adapter, normalization service, route, OpenAPI docs, and tests.
- 2026-06-25: Addressed code review findings and closed story.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm test -- profile-contract.test.ts` failed before contract implementation, then passed.
- `npm test -- profile-file-adapter.test.ts` failed before adapter implementation, then passed.
- `npm test -- profile-service.test.ts` failed before service implementation, then passed.
- `npm test -- profile-route.test.ts` failed before route registration, then passed.
- `npm test -- openapi-document.test.ts` failed before OpenAPI profile docs, then passed.
- `npm test` passed: 21 test files, 137 tests.
- `npm run build` passed after adding `@types/js-yaml`.
- Code review patch validation passed: `npm test` passed with 21 test files and 139 tests; `npm run build` passed.

### Completion Notes List

- Added `ProfileDtoSchema`, checked-in profile examples, and focused contract tests.
- Added fixed read-only profile file adapter using the existing workspace boundary helpers and `js-yaml`.
- Added profile normalization service for MVP fields only, with opaque `sourceRevision` and file `updatedAt`.
- Added protected `GET /api/v1/profile` route under existing `/api/v1` guard; no profile write route or generic command endpoint was added.
- Updated OpenAPI for implemented profile read surface only.
- Resolved code review findings for typed profile file errors, OpenAPI 403 docs, opaque source revision validation, and strict required string arrays.

### File List

- `_bmad-output/implementation-artifacts/2-3-read-and-normalize-profile-config.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `career-ops-wrapper/package.json`
- `career-ops-wrapper/package-lock.json`
- `career-ops-wrapper/contracts/examples/profile.valid.json`
- `career-ops-wrapper/contracts/examples/errors/profile-missing.json`
- `career-ops-wrapper/src/api/profile-routes.ts`
- `career-ops-wrapper/src/api/register-routes.ts`
- `career-ops-wrapper/src/contracts/profile-contract.ts`
- `career-ops-wrapper/src/contracts/index.ts`
- `career-ops-wrapper/src/openapi/openapi-document.ts`
- `career-ops-wrapper/src/services/profile-service.ts`
- `career-ops-wrapper/src/workspace/profile-file-adapter.ts`
- `career-ops-wrapper/test/profile-contract.test.ts`
- `career-ops-wrapper/test/profile-file-adapter.test.ts`
- `career-ops-wrapper/test/profile-route.test.ts`
- `career-ops-wrapper/test/profile-service.test.ts`
- `career-ops-wrapper/test/openapi-document.test.ts`
