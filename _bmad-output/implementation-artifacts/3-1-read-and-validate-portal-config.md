---
created: 2026-06-26
story_key: 3-1-read-and-validate-portal-config
owner: Codex
baseline_commit: e57f3f94c7486cbe1b2782094107f9ac7c700ef3
---

# Story 3.1: Read and Validate Portal Config

Status: done

<!-- Backend only. Read-only Portal Config foundation. Do not touch Android and do not implement portal save or scan readiness in this story. -->

## Story

As a personal mobile app user,
I want the Wrapper Backend to load my Career Ops Portal Config as normalized search criteria,
so that Android can review portals, filters, and queries without reading Career Ops YAML files directly.

## Acceptance Criteria

1. Given the Wrapper Backend is connected to a valid Career Ops Workspace, when `GET /api/v1/portals` is called, then the backend reads only the fixed Portal Config file inside the workspace and returns a normalized `PortalDto`.
2. Given the workspace has either `portals.yml` or `portals.yaml`, when portal read runs, then the backend picks the first existing readable regular file in that order and rejects symlinks or paths resolving outside the workspace.
3. Given the Portal Config exists and is valid, when `GET /api/v1/portals` is called, then the response validates against checked-in `PortalDto` schema/examples and includes `sourceRevision` plus optional `updatedAt`.
4. Given the Portal Config contains invalid YAML or invalid structure, when portal read runs, then the backend returns typed `VALIDATION_ERROR` and does not repair, rewrite, or discard the invalid upstream file.
5. Given the Portal Config is missing or unreadable, when `GET /api/v1/portals` is called, then the backend returns typed `NOT_FOUND` or `WORKSPACE_UNHEALTHY` without exposing local absolute paths.
6. Given upstream Portal Config contains unsupported or unknown fields, when the backend normalizes it, then Android receives only supported normalized MVP fields and the source file is not rewritten or stripped.
7. Given backend logs/errors are inspected, when portal read succeeds or fails, then no full portal config content, secrets, token values, parser command args, or local absolute paths are exposed.
8. Given backend validation runs, when this story is complete, then focused portal contract, fixture, service/adapter, route, OpenAPI, and regression tests pass with `npm test` and `npm run build` from `career-ops-wrapper`.

## Tasks / Subtasks

- [x] Add portal contract and examples. (AC: 1, 3, 4, 8)
  - [x] RED: add failing contract/example tests for a valid `PortalDto`, portal missing error, and portal validation error.
  - [x] Add `career-ops-wrapper/src/contracts/portal-contract.ts` with `PortalDtoSchema`.
  - [x] Export portal schema/type from `career-ops-wrapper/src/contracts/index.ts`.
  - [x] Add checked-in examples under `career-ops-wrapper/contracts/examples/`, including `portal.valid.json` and any missing portal-specific error example needed by tests.

- [x] Add fixed portal file read adapter. (AC: 1, 2, 4, 5, 6, 7, 8)
  - [x] RED: add failing adapter tests for `portals.yml`, `portals.yaml`, missing file, malformed YAML, invalid required fields, unsupported unknown fields, directory path, and symlink/out-of-workspace rejection.
  - [x] Add `career-ops-wrapper/src/workspace/portal-file-adapter.ts`.
  - [x] Reuse `resolveWorkspaceRoot()` and `isInsidePath()` from `workspace/workspace-paths.ts`.
  - [x] Use `node:fs/promises` for file access and the existing `js-yaml` dependency for YAML parsing.
  - [x] Do not write, repair, create, back up, or reformat portal files in this story.

- [x] Add portal normalization service. (AC: 1, 3, 4, 6, 7, 8)
  - [x] RED: add failing service tests for real Career Ops `portals.yml` shape and normalized `PortalDto` output.
  - [x] Add `career-ops-wrapper/src/services/portal-service.ts`.
  - [x] Normalize only MVP fields; do not expose raw YAML or unknown upstream fields in the API response.
  - [x] Include `sourceRevision` as an opaque `portals_sha256_########` hash prefix and `updatedAt` from file mtime where available.

- [x] Add protected portal read route under `/api/v1`. (AC: 1, 3, 5, 7, 8)
  - [x] RED: add Fastify injection tests for `GET /api/v1/portals`, missing portal config, malformed portal config, and Local Pairing Token protection inherited from the existing guard.
  - [x] Add `career-ops-wrapper/src/api/portal-routes.ts`.
  - [x] Register portal routes from `career-ops-wrapper/src/api/register-routes.ts` using the existing `/api/v1` prefix.
  - [x] Keep routes as HTTP mapping only: call `PortalService`, parse response DTO, return it. No filesystem or YAML parsing in route handlers.

- [x] Update OpenAPI for the implemented portal read surface only. (AC: 3, 5, 8)
  - [x] RED: update OpenAPI tests to expect `/api/v1/portals`, `PortalDto`, portal examples, and typed error responses.
  - [x] Update `career-ops-wrapper/src/openapi/openapi-document.ts` using existing `z.toJSONSchema()` conversion.
  - [x] Document `GET /api/v1/portals`; do not document `PUT /api/v1/portals`, scan readiness, offers, reports, artifacts, or generic config endpoints in this story.

- [x] Run validation and close story tasks. (AC: 8)
  - [x] Follow strict TDD: write each focused failing test first and confirm it fails before implementation.
  - [x] Run focused tests during TDD after each behavior turns green.
  - [x] Run `npm test` from `career-ops-wrapper`.
  - [x] Run `npm run build` from `career-ops-wrapper`.
  - [x] Update this story's Dev Agent Record, File List, and task checkboxes only after all validation passes.

### Review Findings

- [x] [Review][Patch] Malformed parent portal config sections can normalize as empty fields [career-ops-wrapper/src/services/portal-service.ts:111]
- [x] [Review][Patch] Malformed optional portal fields are silently dropped [career-ops-wrapper/src/services/portal-service.ts:162]
- [x] [Review][Patch] Location allow-list deduplication happens before trimming [career-ops-wrapper/src/services/portal-service.ts:180]
- [x] [Review][Patch] Unreadable portal file branch lacks focused test coverage [career-ops-wrapper/test/portal-file-adapter.test.ts:57]
- [x] [Review][Patch] Contract rejects valid HTTP URLs with uppercase schemes [career-ops-wrapper/src/contracts/portal-contract.ts:18]

## Dev Notes

### Scope Boundaries

- Backend only. Do not touch `android/`.
- This story is read-only Portal Config. Do not implement `PUT /api/v1/portals`, safe portal save, scan readiness, scan-runs, offers, reports, artifacts, Android UI, Room cache, auth redesign, or a generic YAML/config manager.
- The API must not accept user-provided file paths, filenames, commands, upload format flags, or workspace paths.
- Unknown upstream Portal Config fields are preserved by not rewriting the source file. Merge-preserving writes belong to Story 3.2.
- Do not call Career Ops scanner, provider APIs, Playwright, parser scripts, or `validate-portals.mjs` from the read endpoint. This story validates the YAML shape needed for the mobile DTO only.

### Current Backend Patterns to Reuse

- `career-ops-wrapper/src/server.ts` creates Fastify, sets the shared `mapErrorToResponse()` handler, registers docs, then registers API routes.
- `career-ops-wrapper/src/api/register-routes.ts` mounts routes under `/api/v1` and installs `registerLocalPairingTokenGuard()`.
- `career-ops-wrapper/src/api/profile-routes.ts` shows the current protected read/write resource route pattern.
- `career-ops-wrapper/src/services/profile-service.ts` shows normalization and typed validation-error mapping.
- `career-ops-wrapper/src/workspace/profile-file-adapter.ts` shows fixed YAML file discovery/read, realpath containment, typed missing/unhealthy errors, mtime metadata, and hash-derived `sourceRevision`.
- `career-ops-wrapper/src/workspace/safe-file-adapter.ts` exists for later writes. Do not use it for this read-only story.
- `career-ops-wrapper/src/contracts/index.ts` re-exports contract modules.
- `career-ops-wrapper/src/openapi/openapi-document.ts` is the only OpenAPI generator; extend it rather than adding another package.
- Error responses use existing `ApiError` codes and the stable `{ error: { code, message, details? } }` envelope.

### Portal DTO Requirements

`PortalDto` follows the architecture MVP schema:

```ts
{
  titlePositiveKeywords: string[];
  titleNegativeKeywords: string[];
  locationAllowList: string[];
  locationBlockList: string[];
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  trackedCompanies: Array<{
    id?: string;
    name: string;
    careersUrl: string;
    provider?: string | null;
    enabled: boolean;
  }>;
  searchQueries: Array<{
    id?: string;
    label: string;
    query: string;
    enabled: boolean;
  }>;
  sourceRevision?: string;
  updatedAt?: string | null;
}
```

Validation:

- Keyword/location arrays are optional in source YAML but normalized responses return arrays.
- `salaryMin` and `salaryMax` are optional non-negative integers. If both exist, `salaryMax >= salaryMin`.
- `salaryCurrency` is required when either salary bound exists and must match `/^[A-Z]{3}$/`.
- `trackedCompanies` is required in the response and may be empty.
- Each tracked company requires non-empty `name`, HTTP/HTTPS `careersUrl`, and boolean `enabled`.
- `provider` is optional string or null. Keep provider validation simple in this story; do not dynamically import provider modules.
- `searchQueries` is required in the response and may be empty.
- Each search query requires non-empty `label`, non-empty `query`, and boolean `enabled`.
- Nested `id` fields are optional opaque IDs generated by backend if absent.
- `sourceRevision` must match `portals_sha256_[a-f0-9]{8}` and must not reveal filesystem paths.
- Success responses return `PortalDto` directly. Do not wrap success in `{ success, data }`.

### Normalization Mapping

Use the real Career Ops portal shape from `/Users/dthuy/Workspace/career-ops/portals.yml` and `/Users/dthuy/Workspace/career-ops/templates/portals.example.yml` as implementation guides.

- `titlePositiveKeywords`: `title_filter.positive` string array, default `[]`.
- `titleNegativeKeywords`: `title_filter.negative` string array, default `[]`.
- `locationAllowList`: combine `location_filter.always_allow` and `location_filter.allow` without duplicates, default `[]`.
- `locationBlockList`: `location_filter.block` string array, default `[]`.
- `salaryMin`: `salary_filter.min` when it is a non-negative number.
- `salaryMax`: `salary_filter.max` when it is a non-negative number; treat `0` as absent/no upper limit.
- `salaryCurrency`: uppercase `salary_filter.currency` when salary bounds are emitted.
- `trackedCompanies`: from `tracked_companies`, default `[]`; include enabled and disabled entries so Android can show current config. Map `careers_url` to `careersUrl`; generate deterministic opaque `id` from name or URL when absent.
- `searchQueries`: from `search_queries`, default `[]`; map source `name` to `label`; generate deterministic opaque `id` from label/query when absent.

Reject malformed YAML and invalid source structures with `VALIDATION_ERROR`. Do not silently invent required company/query data when entries exist but required fields are malformed.

### Portal File Semantics

- Supported portal file search order: `portals.yml`, `portals.yaml`.
- Reads must stay inside the configured Career Ops Workspace.
- Existing symlinks that resolve outside the workspace must be rejected.
- Direct symlinks should be rejected to match the stricter profile adapter behavior.
- Directories named like portal files are invalid, not ready.
- Missing portal file maps to `NOT_FOUND`.
- Unreadable workspace or unreadable portal file maps to `WORKSPACE_UNHEALTHY`.
- Malformed YAML or unsupported structure maps to `VALIDATION_ERROR`.
- Do not log or return raw YAML, full portal content, parser args, secrets, token values, or local absolute paths.

### Testing Requirements

- Use Vitest. Follow strict TDD: write the failing test first and verify it fails before production code.
- Add/update tests in the existing flat `career-ops-wrapper/test/` style.
- Required focused coverage:
  - `PortalDtoSchema` accepts a valid normalized example and rejects invalid salary ordering, missing salary currency when salary bounds exist, bad careers URL, bad query entry, and bad `sourceRevision`.
  - Checked-in portal examples parse with Zod.
  - Adapter reads `portals.yml` before `portals.yaml`.
  - Unknown YAML fields do not leak into `PortalDto` and the source YAML remains unchanged.
  - Missing, unreadable, malformed, directory, and out-of-workspace symlink cases map to typed errors.
  - Service normalizes real Career Ops portal YAML fields into `PortalDto`.
  - `GET /api/v1/portals` returns valid DTO for fixture workspace and inherits Local Pairing Token protection in LAN/private mode.
  - Generic command endpoints remain 404; do not add `/run`, `/exec`, `/command`, or a generic config endpoint.
  - OpenAPI includes health, CV, profile, and the implemented portal read endpoint only.

Minimum validation:

```bash
cd career-ops-wrapper
npm test
npm run build
```

### Project Structure Notes

Expected files to add:

- `career-ops-wrapper/src/contracts/portal-contract.ts`
- `career-ops-wrapper/src/api/portal-routes.ts`
- `career-ops-wrapper/src/services/portal-service.ts`
- `career-ops-wrapper/src/workspace/portal-file-adapter.ts`
- `career-ops-wrapper/contracts/examples/portal.valid.json`
- Portal-focused tests under `career-ops-wrapper/test/`

Expected files to update:

- `career-ops-wrapper/src/contracts/index.ts`
- `career-ops-wrapper/src/api/register-routes.ts`
- `career-ops-wrapper/src/openapi/openapi-document.ts`
- `career-ops-wrapper/test/openapi-document.test.ts`
- Existing contract/example tests as needed.

No new runtime dependency is expected. `js-yaml`, Zod, Fastify, Node `fs/promises`, and existing workspace path helpers are enough.

### Previous Story Intelligence

- Story 2.1 implemented CV read/write and the shared safe-file foundation; do not duplicate CV contract, route, or file adapter behavior.
- Story 2.3 implemented read-only Profile Config adapter/service/route/OpenAPI. Mirror that shape for Portal Config instead of inventing a new config layer.
- Story 2.3 review hardened profile file read error mapping, stat/read races, OpenAPI 403 docs, opaque `sourceRevision`, and strict required string array validation. Keep portal read equally strict.
- Story 2.4 implemented safe Profile Config save and review fixes for raw body limits, malformed existing config, and symlinked parent directories. Those are useful for Story 3.2, but this story should stay read-only.
- Current worktree includes uncommitted Story 2.4 backend files. Treat them as current source, not as changes to revert.

### Latest Technical Notes

- No latest-version research is required for this story because it adds no dependency and does not upgrade Fastify, Zod, TypeScript, Vitest, or `js-yaml`.
- Fastify 5 route validation can use JSON Schema, but this repo currently uses explicit Zod parsing plus Zod-derived OpenAPI; keep the local pattern.
- Zod 4 first-party `z.toJSONSchema()` is already used in `openapi-document.ts`; do not add `zod-to-json-schema`.
- Node `fs/promises`, `realpath`, `lstat`, `stat`, and existing workspace path helpers are enough for read-only portal access.

### References

- [Epic 3 Story 3.1](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/epics.md:635)
- [Architecture PortalDto](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/architecture.md:1440)
- [Architecture Backend Module Boundaries](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/architecture.md:992)
- [Architecture Portal Backend Files](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/architecture.md:1152)
- [Project Context Backend Stack](/Users/dthuy/Workspace/jobflow/_bmad-output/project-context.md:31)
- [Story 2.3 Profile Read Implementation](/Users/dthuy/Workspace/jobflow/_bmad-output/implementation-artifacts/2-3-read-and-normalize-profile-config.md)
- [Story 2.4 Profile Save Implementation](/Users/dthuy/Workspace/jobflow/_bmad-output/implementation-artifacts/2-4-save-profile-config-safely.md)
- [Real Career Ops Portal Config](/Users/dthuy/Workspace/career-ops/portals.yml)
- [Real Career Ops Portal Example](/Users/dthuy/Workspace/career-ops/templates/portals.example.yml)
- [Real Career Ops Portal Validator](/Users/dthuy/Workspace/career-ops/validate-portals.mjs)

## Change Log

- 2026-06-26: Created backend-only read/validate Portal Config story with existing profile-read pattern reuse guardrails.
- 2026-06-26: Implemented read-only portal contract, adapter, normalization service, protected route, OpenAPI docs, and focused Vitest coverage.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm test -- portal-contract.test.ts` (RED: missing schema/examples; GREEN: 3 passed)
- `npm test -- portal-file-adapter.test.ts` (RED: missing adapter; GREEN: 7 passed)
- `npm test -- portal-service.test.ts` (RED: missing service; GREEN: 2 passed)
- `npm test -- portal-route.test.ts` (RED: 404 for `/api/v1/portals`; GREEN: 7 passed)
- `npm test -- openapi-document.test.ts` (RED: missing portal path/schema/examples; GREEN: 4 passed)
- `npm test -- portal-contract.test.ts portal-file-adapter.test.ts portal-service.test.ts portal-route.test.ts openapi-document.test.ts` (23 passed)
- `npm run build` (passed)
- `npm test` (25 test files, 178 tests passed)
- Review patch validation: `npm test -- portal-contract.test.ts portal-service.test.ts portal-file-adapter.test.ts` (17 passed), `npm test` (25 test files, 183 tests passed), `npm run build` (passed)

### Completion Notes List

- Added `PortalDtoSchema`, portal success example, and portal missing error example.
- Added read-only portal file adapter for fixed `portals.yml` then `portals.yaml`, with workspace containment, symlink rejection, typed missing/unhealthy/validation errors, hash `sourceRevision`, and mtime metadata.
- Added portal normalization service for MVP fields only: keyword/location arrays, salary bounds/currency, tracked companies, search queries, opaque IDs, `sourceRevision`, and `updatedAt`.
- Added protected `GET /api/v1/portals` route and registered it under existing `/api/v1` Local Pairing Token guard.
- Updated OpenAPI for the implemented portal read endpoint only; no portal save, scan readiness, offers, reports, artifacts, or generic command/config endpoints were added.
- Addressed code review findings by rejecting malformed parent/optional portal fields, trimming before location dedupe, accepting uppercase HTTP URL schemes, and adding unreadable-file test coverage.

### File List

- `_bmad-output/implementation-artifacts/3-1-read-and-validate-portal-config.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `career-ops-wrapper/contracts/examples/errors/portal-missing.json`
- `career-ops-wrapper/contracts/examples/portal.valid.json`
- `career-ops-wrapper/src/api/portal-routes.ts`
- `career-ops-wrapper/src/api/register-routes.ts`
- `career-ops-wrapper/src/contracts/index.ts`
- `career-ops-wrapper/src/contracts/portal-contract.ts`
- `career-ops-wrapper/src/openapi/openapi-document.ts`
- `career-ops-wrapper/src/services/portal-service.ts`
- `career-ops-wrapper/src/workspace/portal-file-adapter.ts`
- `career-ops-wrapper/test/openapi-document.test.ts`
- `career-ops-wrapper/test/portal-contract.test.ts`
- `career-ops-wrapper/test/portal-file-adapter.test.ts`
- `career-ops-wrapper/test/portal-route.test.ts`
- `career-ops-wrapper/test/portal-service.test.ts`
