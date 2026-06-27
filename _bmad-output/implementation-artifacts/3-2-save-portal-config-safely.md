---
created: 2026-06-27
story_key: 3-2-save-portal-config-safely
owner: Codex
baseline_commit: 5260e8a63bd43fbf56835809d278294ee2dc2cb1
---

# Story 3.2: Save Portal Config Safely

Status: done

## Scope Note

Backend only. Add safe Portal Config save support behind `PUT /api/v1/portals`. Do not touch Android in this story, and do not implement scan readiness, scan execution, offers, reports, artifacts, or any generic YAML/config editor.

## Story

As a personal mobile app user,  
I want the Wrapper Backend to safely save edited MVP Portal Config fields,  
so that Career Ops scans use my latest job portals and search criteria without corrupting the existing `portals.yml`.

## Acceptance Criteria

1. Given Android submits edited MVP Portal Fields, when `PUT /api/v1/portals` receives the request, the backend validates required fields, supported value formats, and UTF-8 JSON payload size before touching the filesystem; payloads over 128 KiB are rejected with a typed payload-size error.
2. Invalid input, including blank required strings, malformed arrays, invalid salary bounds/currency combinations, non-http(s) career URLs, malformed companies/queries, invalid provider/id values, or oversized payloads, returns actionable typed validation details and does not modify the existing Portal Config.
3. Existing Portal Config files with unsupported or unknown upstream fields preserve those semantic keys/values where practical; only supported edited MVP fields are intentionally changed.
4. Valid saves write only to the configured workspace and only to the fixed supported Portal Config locations: first existing `portals.yml`, then existing `portals.yaml`; if neither exists, create `portals.yml`.
5. Valid saves use the existing safe workspace file-write helper so the previous known-good file is backed up/preserved before the active file is replaced.
6. Existing malformed YAML, malformed Portal Config structure, direct symlinks, unsafe parent symlinks, directories, unreadable files, missing workspaces, or out-of-workspace targets produce typed errors and are not overwritten or "repaired" by save.
7. Successful saves perform read-after-write verification through the Portal adapter/service and return the saved normalized `PortalDto` with updated `sourceRevision` and `updatedAt` metadata.
8. Midway write failures leave the previous known-good config available and return a recoverable typed error without leaking raw YAML, secrets, tokens, absolute paths, or full config content.
9. The implementation is covered by focused contract, adapter, service, route, and OpenAPI tests, and the backend passes `npm test` and `npm run build`.

## Tasks / Subtasks

- [x] Add Portal save request contract and examples (AC: 1, 2, 7, 9)
  - [x] Write failing contract tests for valid `SavePortalRequestDto`, invalid salary/currency combinations, invalid URLs, invalid provider/id values, malformed companies/queries, and oversized payload handling.
  - [x] Update `career-ops-wrapper/src/contracts/portal-contract.ts` with `PORTAL_CONFIG_MAX_BYTES = 128 * 1024` and `SavePortalRequestDtoSchema`.
  - [x] Export the save request type/schema through the existing contract barrel if one is used locally.
  - [x] Keep `sourceRevision` and `updatedAt` response-only metadata; they must not be written back into the upstream Portal Config.

- [x] Extend the fixed Portal file adapter with safe write support (AC: 3, 4, 5, 6, 8, 9)
  - [x] Write failing adapter tests for saving to the first existing supported file, falling back to `portals.yaml`, creating `portals.yml` when no supported file exists, preserving unknown top-level and nested keys, rejecting unsafe/symlinked paths, rejecting malformed existing YAML, and preserving previous content on simulated write failure.
  - [x] Update `career-ops-wrapper/src/workspace/portal-file-adapter.ts` to expose a write method alongside `readPortalConfig()`.
  - [x] Reuse `writeWorkspaceFileSafely()` and existing workspace path helpers; do not duplicate the safe-write algorithm and do not create a generic user-addressable YAML writer.
  - [x] Use `js-yaml` for parse/dump and keep the write target constrained to the fixed `PORTAL_RELATIVE_PATHS`.
  - [x] Validate any existing file before merge/write so malformed upstream YAML is not overwritten.

- [x] Add Portal save service orchestration (AC: 1, 2, 3, 6, 7, 8, 9)
  - [x] Write failing service tests for valid save, invalid request with no modification, unknown-field preservation, read-after-write metadata refresh, malformed existing YAML rejection, missing workspace behavior, and simulated adapter write failure.
  - [x] Extend `career-ops-wrapper/src/services/portal-service.ts` with `savePortals(request)`.
  - [x] Validate the request with `SavePortalRequestDtoSchema` before calling the adapter write path.
  - [x] Merge edited MVP fields into the existing parsed YAML shape:
    - `titlePositiveKeywords` -> `title_filter.positive`
    - `titleNegativeKeywords` -> `title_filter.negative`
    - `locationAllowList` -> `location_filter.allow`, while preserving existing `location_filter.always_allow` and removing duplicate values already covered there
    - `locationBlockList` -> `location_filter.block`
    - salary fields -> `salary_filter.min`, `salary_filter.max`, `salary_filter.currency`
    - `trackedCompanies[].careersUrl` -> `tracked_companies[].careers_url`
    - `searchQueries[].label` -> `search_queries[].name`
  - [x] Preserve existing item-level unknown keys by matching tracked companies by source `id` when present, otherwise by normalized `name` + `careers_url`; match search queries by source `id` when present, otherwise by normalized `name` + `query`.
  - [x] Treat generated opaque response IDs as matching hints only; do not add generated IDs back into upstream YAML unless the source item already had an explicit `id`.
  - [x] Return the normalized `PortalDto` produced by read-after-write, not a DTO assembled from the incoming request.

- [x] Add protected `PUT /api/v1/portals` route (AC: 1, 2, 6, 7, 8, 9)
  - [x] Write failing Fastify route tests for valid save, validation failure, raw oversized JSON body, existing malformed Portal Config, missing workspace, token protection, and error-envelope mapping.
  - [x] Update `career-ops-wrapper/src/api/portal-routes.ts` to register `PUT /portals` with a 128 KiB body limit and a thin handler that delegates to `portalService.savePortals()`.
  - [x] Keep authorization/local-pairing behavior consistent with existing backend routes.
  - [x] Ensure generic command/config endpoints remain unavailable and continue to return 404.

- [x] Update OpenAPI documentation (AC: 1, 2, 7, 9)
  - [x] Write failing OpenAPI tests expecting `PUT /api/v1/portals`, `SavePortalRequestDto`, request examples, successful `PortalDto` response, and typed error responses including validation, unauthorized/forbidden, payload too large, workspace unavailable, and internal failure cases.
  - [x] Update `career-ops-wrapper/src/api/openapi-document.ts` without adding scan readiness, offers, reports, artifacts, or unrelated endpoints.

- [x] Run validation and update implementation notes (AC: 9)
  - [x] Run `npm test` from `career-ops-wrapper`.
  - [x] Run `npm run build` from `career-ops-wrapper`.
  - [x] Record test/build results in the story Dev Agent Record when implemented.

### Review Findings

- [x] [Review][Patch] Validation errors lose actionable details [career-ops-wrapper/src/services/portal-service.ts:69]
- [x] [Review][Patch] Portal payload-too-large responses and OpenAPI example use CV-specific 512 KiB wording [career-ops-wrapper/src/errors/error-mapper.ts:36]
- [x] [Review][Patch] Currency-only salary saves create hidden YAML state [career-ops-wrapper/src/contracts/portal-contract.ts:38]
- [x] [Review][Patch] Duplicate company/query IDs are not rejected before merge [career-ops-wrapper/src/contracts/portal-contract.ts:81]

## Dev Notes

### Backend Context

- The Wrapper Backend is a Node/TypeScript ESM Fastify app under `career-ops-wrapper`.
- The project uses strict `NodeNext` TypeScript, Zod 4, `js-yaml`, Vitest, and existing OpenAPI generation through `z.toJSONSchema()`.
- Do not add new dependencies for this story.
- Story 3.1 completed the read-only Portal Config path. Reuse and preserve its route/service/adapter/contract structure.
- Story 2.4 completed safe Profile Config save support. Reuse that safe-write pattern instead of inventing a second write mechanism.

### Existing Portal Read Behavior To Preserve

- `GET /api/v1/portals` is already implemented through:
  - `career-ops-wrapper/src/contracts/portal-contract.ts`
  - `career-ops-wrapper/src/workspace/portal-file-adapter.ts`
  - `career-ops-wrapper/src/services/portal-service.ts`
  - `career-ops-wrapper/src/api/portal-routes.ts`
  - `career-ops-wrapper/src/api/openapi-document.ts`
- Supported read/write filenames are `portals.yml` and `portals.yaml`.
- Direct symlinks are rejected.
- File reads must stay inside the configured workspace.
- Missing config currently maps to a typed `NOT_FOUND`.
- Malformed YAML or malformed supported Portal structure maps to a typed `VALIDATION_ERROR`.
- Error responses must not leak raw YAML/config content.

### Save Request Shape

Use an editable MVP request DTO that mirrors the editable portions of `PortalDto` and excludes read metadata:

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
}
```

Validation expectations:

- Payload size limit is 128 KiB before filesystem mutation.
- Arrays are required in the request and may be empty where the domain allows an empty list.
- Required strings must be nonblank after trim.
- Career URLs must parse as `http:` or `https:`; uppercase URL schemes should remain accepted if they normalize through `URL`.
- Salary values must be nonnegative, `salaryMax` must be greater than or equal to `salaryMin` when both are present, and `salaryCurrency` is required when any salary bound is present.
- `provider` may be omitted or `null`; non-null provider values must be nonblank strings.
- The request schema excludes `sourceRevision` and `updatedAt`; those are response metadata only.

### YAML Merge Semantics

- Preserve unknown top-level YAML keys where possible.
- Preserve unknown nested keys inside supported sections where possible.
- Preserve existing `location_filter.always_allow` because the read DTO combines `always_allow` and `allow` into one `locationAllowList`; save should write editable allow-list values to `location_filter.allow` after removing values already present in `always_allow`.
- For tracked companies, map supported fields while preserving matched item unknown fields such as parser/provider-specific details, notes, scan method, or other upstream metadata.
- For search queries, map supported fields while preserving matched item unknown fields.
- If the request omits optional salary bounds, treat that as "no filter" for that owned field rather than silently reusing stale editable data.
- Do not promise YAML comments, formatting, or key order preservation; preserve semantic data, not presentation.

### Error Handling

- Keep route handlers thin. Validation/service/adapter layers should produce typed domain errors, and routes should map them into the existing error envelope.
- Oversized raw bodies should be rejected as payload-size failures, not parsed as generic internal errors.
- Write failures should not expose full config, raw YAML, secrets, token values, absolute filesystem paths, or temporary/backup filenames.
- Existing malformed configs must not be overwritten as a "repair" side effect.

### OpenAPI Expectations

- Document `PUT /api/v1/portals` under the existing `/api/v1` API.
- Include `SavePortalRequestDto` request schema and examples.
- Successful response schema is the existing normalized `PortalDto`.
- Include typed error responses for validation errors, unauthorized/forbidden access, payload too large, unavailable/missing workspace, and internal write failures.
- Do not document future scan readiness, scan execution, offers, reports, or artifacts in this story.

### Testing

Required focused test areas:

- `portal-contract.test.ts`: save request validation, salary/currency rules, URL scheme rules, provider/id/string validation, metadata exclusion, payload-size constant.
- `portal-file-adapter.test.ts`: fixed target selection, missing-file create, unknown-field preservation, existing malformed YAML rejection, direct symlink rejection, unsafe parent symlink rejection via safe writer, read-after-write metadata, simulated write failure preserving previous content.
- `portal-service.test.ts`: request validation before write, valid merge, invalid request no modification, unknown-field preservation, read-after-write normalized response, malformed existing config no overwrite.
- `portal-route.test.ts`: `PUT /api/v1/portals`, auth/local-pairing behavior, raw body size limit, validation errors, workspace errors, recoverable write errors, no raw config leak.
- `openapi-document.test.ts`: endpoint, request schema, examples, success response, typed error responses.

Regression commands:

```bash
cd career-ops-wrapper
npm test
npm run build
```

## Project Structure Notes

- Primary backend code lives in `/Users/dthuy/Workspace/jobflow/career-ops-wrapper/src`.
- Existing Portal read tests live under `/Users/dthuy/Workspace/jobflow/career-ops-wrapper/src/**/*.test.ts`.
- Real Career Ops workspace files are external inputs and must not be rewritten by tests. Use temporary workspaces/fixtures.

## References

- `_bmad-output/planning-artifacts/epics.md` - Epic 3 objective and Story 3.2 acceptance criteria.
- `_bmad-output/planning-artifacts/prd.md` - FR-9 Save Portal Config and payload-size addendum.
- `_bmad-output/planning-artifacts/architecture.md` - Portal DTO, route/service/adapter layout, validation constraints, and safe workspace boundaries.
- `_bmad-output/project-context.md` - backend runtime, dependencies, TypeScript, and wrapper architecture facts.
- `_bmad-output/implementation-artifacts/3-1-read-and-validate-portal-config.md` - completed Portal read story and normalization behavior.
- `_bmad-output/implementation-artifacts/2-4-save-profile-config-safely.md` - completed safe Profile Config save pattern and review fixes.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm test -- test/portal-contract.test.ts` failed red before `SavePortalRequestDtoSchema` existed, then passed after contract implementation.
- `npm test -- test/portal-file-adapter.test.ts` failed red before `writePortalConfig()` existed, then passed after adapter safe-write implementation.
- `npm test -- test/portal-service.test.ts` failed red before `savePortals()` existed, then passed after service validation/merge implementation.
- `npm test -- test/portal-route.test.ts` failed red before `PUT /api/v1/portals` existed, then passed after route implementation.
- `npm test -- test/openapi-document.test.ts` failed red before Portal save OpenAPI documentation existed, then passed after OpenAPI update.
- `npm test`: 25 test files passed, 205 tests passed.
- `npm run build`: TypeScript build passed.
- Review patch validation: `npm test -- test/portal-contract.test.ts test/portal-route.test.ts test/openapi-document.test.ts` passed.
- Review patch validation: `npm test` passed with 25 test files and 205 tests; `npm run build` passed.

### Completion Notes

- Added Portal save request contract with 128 KiB validation, editable-field validation, response metadata stripping, and focused contract regression coverage.
- Added Portal adapter safe-write support using the existing workspace safe writer and fixed portal file targets, with backup/read-after-write coverage.
- Added Portal save service orchestration with request validation, semantic existing-config validation, YAML merge preservation, safe adapter write, and normalized read-after-write response.
- Added protected `PUT /api/v1/portals` Fastify route with 128 KiB body limit, route-level body validation, typed error mapping, auth coverage, and no generic command endpoints.
- Added OpenAPI documentation for Portal save request/response/error schemas and request examples without documenting future scan/offers/report surfaces.
- Validation completed with full backend test suite and TypeScript build passing.
- Code review patches resolved: Portal validation details now include issue paths, parser-level payload-too-large wording is generic, currency-only salary saves are rejected, and duplicate company/query IDs are rejected before merge.

### File List

- _bmad-output/implementation-artifacts/3-2-save-portal-config-safely.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- career-ops-wrapper/src/api/portal-routes.ts
- career-ops-wrapper/src/contracts/portal-contract.ts
- career-ops-wrapper/src/errors/error-mapper.ts
- career-ops-wrapper/src/openapi/openapi-document.ts
- career-ops-wrapper/src/services/portal-service.ts
- career-ops-wrapper/src/workspace/portal-file-adapter.ts
- career-ops-wrapper/contracts/examples/errors/payload-too-large.json
- career-ops-wrapper/test/openapi-document.test.ts
- career-ops-wrapper/test/portal-contract.test.ts
- career-ops-wrapper/test/portal-file-adapter.test.ts
- career-ops-wrapper/test/portal-route.test.ts
- career-ops-wrapper/test/portal-service.test.ts

## Change Log

- 2026-06-27: Created story from Epic 3 Story 3.2, PRD FR-9, architecture Portal DTO/save constraints, Story 3.1 read implementation context, and Story 2.4 safe-write precedent.
- 2026-06-27: Added Portal save contract and tests.
- 2026-06-27: Added Portal file adapter safe-write support and tests.
- 2026-06-27: Added Portal save service merge/read-after-write flow and tests.
- 2026-06-27: Added protected Portal save route and route tests.
- 2026-06-27: Added Portal save OpenAPI documentation and tests.
- 2026-06-27: Completed validation and moved story to review.
- 2026-06-27: Resolved code review patch findings and moved story to done.
