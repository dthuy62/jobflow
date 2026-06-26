---
created: 2026-06-25
story_key: 2-4-save-profile-config-safely
owner: Codex
baseline_commit: e57f3f94c7486cbe1b2782094107f9ac7c700ef3
---

# Story 2.4: Save Profile Config Safely

Status: done

<!-- Backend only. Add safe Profile Config save support. Do not touch Android. Keep this scoped to PUT /api/v1/profile and the existing profile read foundation. -->

## Story

As a personal mobile app user,
I want the Wrapper Backend to safely save edited MVP Profile Config fields,
so that Career Ops scans use my latest preferences without corrupting the existing profile YAML.

## Acceptance Criteria

1. Given Android submits edited MVP Profile Fields, when `PUT /api/v1/profile` receives the request, then the backend validates required fields, supported value formats, and UTF-8 payload size before touching the filesystem.
2. Given the save request is invalid, blank in required arrays/strings, has invalid salary values/currency, invalid enum values, or exceeds `128 KiB`, when validation fails, then the backend returns a typed `VALIDATION_ERROR` or `PAYLOAD_TOO_LARGE` response and does not modify the existing Profile Config.
3. Given an existing Profile Config contains unsupported or unknown upstream fields, when supported MVP field changes are saved, then unknown semantic keys/values are preserved where practical and only supported edited fields are intentionally changed.
4. Given a valid Profile Config save request is received, when the backend writes the config, then it writes only to a fixed supported profile file inside the configured Career Ops Workspace and uses the existing safe file write helper for backup/preserve, safer replace, and read-after-write behavior.
5. Given no supported profile file exists yet, when a valid save request is received, then the backend creates `config/profile.yml` inside the workspace using the minimal Career Ops profile YAML shape needed by the current read/normalize service.
6. Given the existing Profile Config is malformed, unreadable, a directory, a symlink, or resolves outside the workspace, when save is attempted, then the backend returns a typed error and does not overwrite or repair the unsafe/malformed existing file.
7. Given the Profile Config write operation fails midway, when the failure is handled, then the previous known-good config remains available and the error response does not leak full profile content, secrets, token values, or absolute local paths.
8. Given the write succeeds, when the save endpoint returns, then the backend reads back through the existing profile adapter/service path and returns a normalized `ProfileDto` with updated `sourceRevision` and `updatedAt`.
9. Given backend validation runs, when this story is complete, then focused profile save contract, adapter/service, route, OpenAPI, mutation-safety, and regression tests pass with `npm test` and `npm run build` from `career-ops-wrapper`.

## Tasks / Subtasks

- [x] Add profile save request contract and examples. (AC: 1, 2, 8, 9)
  - [x] RED: add failing contract/example tests for a valid `SaveProfileRequestDto`, invalid required fields, salary ordering, missing salary currency, bad remote enum, and oversized payload behavior.
  - [x] Update `career-ops-wrapper/src/contracts/profile-contract.ts` with `PROFILE_CONFIG_MAX_BYTES` and `SaveProfileRequestDtoSchema`.
  - [x] Export the new schema/type from `career-ops-wrapper/src/contracts/index.ts`.
  - [x] Add or update checked-in profile save examples only if needed by contract/OpenAPI tests; do not add unrelated Profile/Portal examples.

- [x] Extend the fixed profile file adapter with safe write support. (AC: 3, 4, 5, 6, 7, 9)
  - [x] RED: add failing adapter tests for saving to the first existing supported profile file, creating `config/profile.yml` when none exists, preserving unknown YAML keys, rejecting symlink/out-of-workspace candidates, rejecting malformed existing YAML, and preserving previous content on simulated write failure.
  - [x] Update `career-ops-wrapper/src/workspace/profile-file-adapter.ts`; do not create a generic YAML file manager.
  - [x] Reuse `writeWorkspaceFileSafely()` from `workspace/safe-file-adapter.ts` and existing `resolveWorkspaceRoot()` / `isInsidePath()` path checks.
  - [x] Use the already-installed `js-yaml` dependency to dump YAML. Preserve semantic unknown keys/values where practical; comment/order preservation is not an API contract.
  - [x] Use the existing supported file search order: `config/profile.yml`, `config/profile.yaml`, `profile.yml`, `profile.yaml`; create `config/profile.yml` only when none exists.

- [x] Add profile save orchestration in the service. (AC: 1, 2, 3, 8, 9)
  - [x] RED: add failing service tests for valid save, invalid request not modifying YAML, unknown-field preservation, read-after-write metadata update, and malformed existing YAML rejection.
  - [x] Update `career-ops-wrapper/src/services/profile-service.ts` with `saveProfile(request)`.
  - [x] Validate request size before adapter writes.
  - [x] Merge supported MVP fields into the parsed existing YAML shape:
    - `targetRoles` -> `target_roles.primary`
    - `seniorityLevel` -> first `target_roles.archetypes[].level`, creating one minimal archetype only when needed
    - `mustHaveSkills` -> `narrative.superpowers`
    - `positioningSummary` -> `narrative.headline` when present
    - salary fields -> `compensation.minimum`, `compensation.target_range`, and `compensation.currency`
    - `remotePreference` -> `compensation.location_flexibility`
    - `workAuthorizationNote` -> `location.visa_status` when present
    - `preferredLocations` -> deterministic minimal `location.city` / `location.country` values while preserving other `location` keys
  - [x] Return the saved normalized `ProfileDto` by reading back through the existing adapter and `ProfileDtoSchema`.

- [x] Add protected profile save route under `/api/v1`. (AC: 1, 2, 7, 8, 9)
  - [x] RED: add Fastify injection tests for `PUT /api/v1/profile`, invalid payloads, oversized payloads, missing profile creation, malformed existing profile, and Local Pairing Token protection inherited from the existing guard.
  - [x] Update `career-ops-wrapper/src/api/profile-routes.ts` to register `PUT /profile`.
  - [x] Keep routes as HTTP mapping only: parse body shape, call `ProfileService`, parse the response DTO, return it.
  - [x] Ensure `/api/v1/run`, `/api/v1/exec`, `/api/v1/command`, and any generic config endpoint remain unregistered.

- [x] Update OpenAPI for implemented profile save support. (AC: 1, 2, 8, 9)
  - [x] RED: update OpenAPI tests to expect `PUT /api/v1/profile`, `SaveProfileRequestDto`, request body examples, and typed `400`, `401`, `403`, `413`, `503`, and `500` responses.
  - [x] Update `career-ops-wrapper/src/openapi/openapi-document.ts` using existing `z.toJSONSchema()` conversion.
  - [x] Keep OpenAPI limited to implemented health, CV, and profile surfaces; do not document Portal, Scan, Offer, Report, or Artifact endpoints in this story.

- [x] Run validation and close story tasks. (AC: 9)
  - [x] Run focused tests during TDD after each behavior turns green.
  - [x] Run `npm test` from `career-ops-wrapper`.
  - [x] Run `npm run build` from `career-ops-wrapper`.
  - [x] Update this story's Dev Agent Record, File List, and task checkboxes only after all validation passes.

### Review Findings

- [x] [Review][Decision] Define clear semantics for omitted optional editable fields — resolved: omitted optional editable fields preserve existing Career Ops config values for now.
- [x] [Review][Patch] Raw oversized JSON can still save [career-ops-wrapper/src/api/profile-routes.ts:14]
- [x] [Review][Patch] Semantically malformed existing profiles can be repaired/overwritten [career-ops-wrapper/src/services/profile-service.ts:31]
- [x] [Review][Patch] First-time create can write outside workspace through symlinked `config/` directory [career-ops-wrapper/src/workspace/profile-file-adapter.ts:70]

## Dev Notes

### Scope Boundaries

- Backend only. Do not touch `android/`.
- This story adds Profile Config save only. Do not implement Portal Config, scan readiness, scan-runs, offers, reports, artifacts, Android UI, Room cache, auth redesign, or a generic YAML editor.
- The API must not accept user-provided file paths, filenames, workspace paths, command strings, or arbitrary YAML text.
- Save request shape should represent MVP editable fields, not backend metadata. `sourceRevision` and `updatedAt` remain response metadata only.
- Do not preserve YAML comments/order as a promised behavior. Preserve unknown semantic YAML keys and values where `js-yaml` object merge/dump allows it.

### Current Backend Patterns to Reuse

- `career-ops-wrapper/src/api/profile-routes.ts` currently registers `GET /profile`; extend this file with `PUT /profile`.
- `career-ops-wrapper/src/services/profile-service.ts` currently owns normalization; extend it with save orchestration and keep route handlers thin.
- `career-ops-wrapper/src/workspace/profile-file-adapter.ts` currently owns fixed profile file discovery/read/parsing; extend it with fixed write support.
- `career-ops-wrapper/src/workspace/safe-file-adapter.ts` already provides target locking, backup, temp write, replace, and read-after-write verification. Reuse it instead of adding another writer.
- `career-ops-wrapper/src/workspace/workspace-paths.ts` exposes `resolveWorkspaceRoot()` and `isInsidePath()`; keep all profile writes inside those helpers.
- `career-ops-wrapper/src/contracts/profile-contract.ts` already defines `ProfileDtoSchema`; add only the save request schema and profile size constant needed for this story.
- `career-ops-wrapper/src/openapi/openapi-document.ts` is the only OpenAPI generator; extend it instead of adding another package.
- Error responses use existing `ApiError` codes and the stable `{ error: { code, message, details? } }` envelope.

### SaveProfileRequestDto Requirements

Use a request schema that matches editable MVP fields and excludes response metadata:

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
  niceToHaveSkills?: string[];
  excludedKeywords?: string[];
  positioningSummary?: string;
}
```

Validation:

- `targetRoles`, `seniorityLevel`, and `preferredLocations` are required and non-empty after trimming.
- `remotePreference` enum is required.
- `salaryMin` and `salaryMax` are optional non-negative integers. If both exist, `salaryMax >= salaryMin`.
- `salaryCurrency` is required when either salary bound exists and must match `/^[A-Z]{3}$/`.
- Optional arrays default to `[]` when saved/normalized.
- `positioningSummary` is optional, non-empty when present, and max 2000 chars.
- Request payload max is `128 KiB` measured as UTF-8 JSON bytes before writing.
- Success responses return `ProfileDto` directly. Do not wrap success in `{ success, data }`.

### Profile File Semantics

- Supported profile file search order remains `config/profile.yml`, `config/profile.yaml`, `profile.yml`, `profile.yaml`.
- Save target is the first existing supported regular file in that order.
- If no supported profile file exists, create `config/profile.yml`.
- Direct symlinks must be rejected. Existing paths resolving outside the workspace must be rejected.
- Existing malformed YAML must return `VALIDATION_ERROR` and must not be overwritten.
- Existing unreadable file/directory/workspace issues map to `WORKSPACE_UNHEALTHY`.
- Out-of-workspace paths map to `PATH_OUTSIDE_WORKSPACE`.
- Missing workspace maps to `WORKSPACE_UNHEALTHY`.
- Do not log or return raw YAML, full profile content, secrets, token values, or local absolute paths.

### Merge Mapping

Use the real Career Ops profile shape from `/Users/dthuy/Workspace/career-ops/config/profile.yml` and `config/profile.example.yml` as the source shape. Minimal merge behavior:

- Preserve all existing top-level and nested keys that are not explicitly owned by the MVP save request.
- Update `target_roles.primary` from `targetRoles`.
- Update the first `target_roles.archetypes[].level` from `seniorityLevel`. If the array is absent/empty, create one minimal archetype using the first role as `name`, the requested level, and `fit: "primary"`.
- Update `narrative.superpowers` from `mustHaveSkills`.
- Update `narrative.headline` from `positioningSummary` when present. Leave `narrative.exit_story` and `narrative.proof_points` untouched.
- Update `compensation.minimum` from `salaryMin` when present.
- Update `compensation.target_range` from `salaryMin`/`salaryMax` when present.
- Update `compensation.currency` from `salaryCurrency` when salary bounds exist.
- Update `compensation.location_flexibility` from `remotePreference` using stable plain strings such as `Remote`, `Hybrid`, `On-site`, `Flexible`, or `Unknown`.
- Update `location.visa_status` from `workAuthorizationNote` when present.
- For `preferredLocations`, use a deterministic minimal mapping: first value to `location.city`, second value to `location.country`, and preserve other existing `location` keys.
- `niceToHaveSkills` and `excludedKeywords` are accepted by the request schema for mobile contract continuity, but there is no current clear upstream source in the existing Career Ops profile YAML. Preserve them through response defaults only unless an obvious existing source is found during implementation.

### Testing Requirements

- Use Vitest. Follow strict TDD: write the failing test first and verify it fails before production code.
- Add/update tests in the existing flat `career-ops-wrapper/test/` style.
- Required focused coverage:
  - `SaveProfileRequestDtoSchema` accepts valid editable MVP fields and rejects invalid required arrays/strings, remote enum, salary ordering, missing salary currency, and oversized payloads.
  - Save to existing `config/profile.yml` preserves unknown top-level and nested keys.
  - Save creates `config/profile.yml` when no supported profile file exists.
  - Invalid request does not modify the existing YAML.
  - Malformed existing YAML does not get overwritten by save.
  - Symlink/out-of-workspace profile paths are rejected.
  - Simulated write failure preserves previous profile content.
  - `PUT /api/v1/profile` returns a valid saved `ProfileDto` with updated metadata.
  - Profile endpoints inherit Local Pairing Token protection in LAN/private mode.
  - Generic command endpoints remain 404.
  - OpenAPI documents health, CV, profile read, and profile save only.

Minimum validation:

```bash
cd career-ops-wrapper
npm test
npm run build
```

### Project Structure Notes

Expected files to update:

- `career-ops-wrapper/src/contracts/profile-contract.ts`
- `career-ops-wrapper/src/contracts/index.ts`
- `career-ops-wrapper/src/workspace/profile-file-adapter.ts`
- `career-ops-wrapper/src/services/profile-service.ts`
- `career-ops-wrapper/src/api/profile-routes.ts`
- `career-ops-wrapper/src/openapi/openapi-document.ts`
- `career-ops-wrapper/test/profile-contract.test.ts`
- `career-ops-wrapper/test/profile-file-adapter.test.ts`
- `career-ops-wrapper/test/profile-service.test.ts`
- `career-ops-wrapper/test/profile-route.test.ts`
- `career-ops-wrapper/test/openapi-document.test.ts`

Possible files to update only if tests require checked-in examples:

- `career-ops-wrapper/contracts/examples/profile.valid.json`
- `career-ops-wrapper/contracts/examples/errors/validation.json`
- `career-ops-wrapper/contracts/examples/errors/payload-too-large.json`

No new runtime dependency is expected. `js-yaml`, Zod, Fastify, Node `fs/promises`, and the existing safe file adapter are enough.

### Previous Story Intelligence

- Story 2.1 implemented the shared safe file write helper. Do not duplicate backup/temp-write/lock behavior.
- Story 2.1 review hardened symlink target/backup handling, parser/body-limit error mapping, concurrent save correctness, invalid existing CV reads, and OpenAPI workspace-unhealthy responses. Preserve those patterns.
- Story 2.3 implemented read-only profile adapter/service/route/OpenAPI. Extend that code instead of replacing it.
- Story 2.3 review hardened profile file read error mapping, stat/read races, OpenAPI 403 docs, opaque `sourceRevision`, and strict required string array validation. Do not loosen those checks.

### Latest Technical Notes

- No latest-version research is required for this story because it adds no new dependency and does not upgrade Fastify, Zod, TypeScript, Vitest, or `js-yaml`.
- Fastify 5 route validation can use JSON Schema, but this repo currently uses explicit Zod parsing plus Zod-derived OpenAPI; keep the local pattern.
- Zod 4 first-party `z.toJSONSchema()` is already used in `openapi-document.ts`; do not add `zod-to-json-schema`.
- Node `fs/promises` plus the existing `writeWorkspaceFileSafely()` helper are enough for profile file mutation safety.

### References

- [Epic 2 Story 2.4](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/epics.md:432)
- [PRD FR-7 Save Profile Config](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/prd.md:247)
- [Architecture ProfileDto](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/architecture.md:1406)
- [Architecture Safe File Contract](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/architecture.md:347)
- [Architecture API Response Formats](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/architecture.md:608)
- [Architecture Backend Module Boundaries](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/architecture.md:994)
- [Project Context Backend Stack](/Users/dthuy/Workspace/jobflow/_bmad-output/project-context.md:31)
- [Story 2.1 Safe File Implementation](/Users/dthuy/Workspace/jobflow/_bmad-output/implementation-artifacts/2-1-read-cv-markdown-from-career-ops-workspace.md)
- [Story 2.3 Profile Read Implementation](/Users/dthuy/Workspace/jobflow/_bmad-output/implementation-artifacts/2-3-read-and-normalize-profile-config.md)
- [Real Career Ops Profile Config](/Users/dthuy/Workspace/career-ops/config/profile.yml)
- [Real Career Ops Profile Example](/Users/dthuy/Workspace/career-ops/config/profile.example.yml)

## Change Log

- 2026-06-25: Created backend-only profile save story with existing safe-file/profile-read reuse guardrails.
- 2026-06-25: Implemented safe Profile Config save contract, adapter, service, route, OpenAPI docs, and tests.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm test -- profile-contract.test.ts` failed before `SaveProfileRequestDtoSchema` existed, then passed after contract implementation.
- `npm test` passed after profile save contract update: 21 test files, 142 tests.
- `npm test -- profile-file-adapter.test.ts` failed before `writeProfileConfig()` existed, then passed after adapter write support.
- `npm test` passed after profile file adapter update: 21 test files, 146 tests.
- `npm test -- profile-service.test.ts` failed before `saveProfile()` existed, then passed after service save orchestration.
- `npm test` passed after profile service update: 21 test files, 150 tests.
- `npm test -- profile-route.test.ts` failed with `PUT /api/v1/profile` returning 404 before route registration, then passed.
- `npm test` passed after profile route update: 21 test files, 156 tests.
- `npm test -- openapi-document.test.ts` failed before OpenAPI documented profile save, then passed after OpenAPI update.
- `npm test` passed after OpenAPI update: 21 test files, 156 tests.
- `npm run build` passed after all Story 2.4 implementation.
- Review regression tests failed before fixes for raw oversized JSON, semantically malformed profile repair, and symlinked parent directory writes; focused tests passed after fixes.
- `npm test` passed after review fixes: 21 test files, 159 tests.
- `npm run build` passed after review fixes.

### Completion Notes List

- Added `PROFILE_CONFIG_MAX_BYTES` and `SaveProfileRequestDtoSchema` for editable MVP Profile Config save payloads.
- Extended the profile file adapter with fixed-target safe YAML writes using the existing safe file helper.
- Added profile save service orchestration for request validation, MVP-field merge, write, and read-after-write normalization.
- Added protected `PUT /api/v1/profile` route using the existing profile service and Local Pairing Token guard.
- Updated OpenAPI with `PUT /api/v1/profile`, `SaveProfileRequestDto`, profile save request example, and typed save responses.
- Completed backend-only validation with `npm test` and `npm run build`; no Android files were touched.
- Fixed review findings by enforcing route raw body limit, validating existing profile semantics before save merge, and rejecting safe writes through symlinked parent directories.

### File List

- `_bmad-output/implementation-artifacts/2-4-save-profile-config-safely.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `career-ops-wrapper/src/contracts/profile-contract.ts`
- `career-ops-wrapper/src/workspace/safe-file-adapter.ts`
- `career-ops-wrapper/src/workspace/profile-file-adapter.ts`
- `career-ops-wrapper/src/services/profile-service.ts`
- `career-ops-wrapper/src/api/profile-routes.ts`
- `career-ops-wrapper/src/openapi/openapi-document.ts`
- `career-ops-wrapper/test/profile-contract.test.ts`
- `career-ops-wrapper/test/safe-file-adapter.test.ts`
- `career-ops-wrapper/test/profile-file-adapter.test.ts`
- `career-ops-wrapper/test/profile-service.test.ts`
- `career-ops-wrapper/test/profile-route.test.ts`
- `career-ops-wrapper/test/openapi-document.test.ts`
