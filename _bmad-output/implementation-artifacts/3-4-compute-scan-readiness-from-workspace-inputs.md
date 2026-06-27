---
created: 2026-06-27
story_key: 3-4-compute-scan-readiness-from-workspace-inputs
owner: Codex
baseline_commit: 5260e8a63bd43fbf56835809d278294ee2dc2cb1
---

# Story 3.4: Compute Scan Readiness from Workspace Inputs

Status: done

## Scope Note

Backend only. Add a typed scan-readiness computation surface that Android can use for scan gating. Do not touch Android in this story, and do not implement scan execution, scan-run lifecycle, offers, reports, artifacts, parser projection, persisted run state, or any generic command endpoint.

## Story

As a personal mobile app user,
I want the backend to compute scan readiness from all required Career Ops inputs,
so that the app can prevent scan attempts that are guaranteed to fail.

## Acceptance Criteria

1. Given the Wrapper Backend is connected to a Career Ops Workspace, when Android calls `GET /api/v1/scan-readiness`, then the backend evaluates wrapper service availability, workspace readiness, Career Ops local scanner prerequisites, CV readiness, Profile Config readiness, and Portal Config readiness, and returns a typed `ScanReadinessDto` suitable for Android display and scan gating.
2. Given all required inputs are present and valid, when scan readiness is computed, then the response marks scan readiness as `ready`, sets `canStartScan` to `true`, includes `computedAt`, and includes concise success checks for wrapper, workspace, scanner, CV, profile, and portal.
3. Given one or more required inputs are missing, invalid, unreadable, outside the workspace, or otherwise not ready, when scan readiness is computed, then the response marks scan readiness as `notReady`, sets `canStartScan` to `false`, and includes distinct readiness messages and stable requirement keys for each failing category.
4. Given Profile Config or Portal Config contains invalid YAML or invalid supported structure, when readiness is computed, then the backend reports the validation category clearly and does not repair, rewrite, create, back up, or discard upstream files.
5. Given readiness computation reads source files, when file access is performed, then all reads stay inside the configured Career Ops Workspace through existing workspace adapters/path helpers and the response/logs do not include full CV, profile, portal content, secrets, local pairing tokens, or absolute workspace paths.
6. Given the Wrapper Backend is in LAN/private mode, when `GET /api/v1/scan-readiness` is called, then it follows the existing protected-route Local Pairing Token behavior; health remains public but readiness is protected.
7. Given OpenAPI is generated, when `/api/v1/openapi.json` is inspected, then it documents `GET /api/v1/scan-readiness`, `ScanReadinessDto`, checked-in examples for ready and not-ready readiness, and typed error responses without documenting scan start, offers, reports, artifacts, or generic command APIs.
8. Given backend readiness tests run, when fixture workspaces represent ready, missing CV, invalid CV, missing profile, invalid profile, missing portal, invalid portal, invalid workspace, unavailable scanner, token protection, and mixed-failure cases, then tests prove readiness status, `canStartScan`, provenance, distinct messages, no file mutation, no path/content leakage, and no generic command endpoints.
9. Given validation runs, when this story is complete, then focused contract, service, route, OpenAPI, and regression tests pass with `npm test` and `npm run build` from `career-ops-wrapper`.

## Tasks / Subtasks

- [x] Add scan readiness contract and examples (AC: 1, 2, 3, 5, 7, 9)
  - [x] RED: add failing contract tests for valid ready and not-ready `ScanReadinessDto` examples, invalid status values, missing required checks, invalid `computedAt`, invalid source revisions, and invalid detail/error-code shapes.
  - [x] Add `career-ops-wrapper/src/contracts/scan-readiness-contract.ts`.
  - [x] Export the schema/type from `career-ops-wrapper/src/contracts/index.ts`.
  - [x] Add checked-in examples under `career-ops-wrapper/contracts/examples/scan-readiness.ready.json` and `career-ops-wrapper/contracts/examples/scan-readiness.not-ready.json`.
  - [x] Keep DTO field names camelCase and success response direct, not wrapped in `{ success, data }`.

- [x] Add scan readiness service orchestration (AC: 1, 2, 3, 4, 5, 8, 9)
  - [x] RED: add failing service tests for ready workspace, missing CV, blank/oversized CV, missing profile, invalid profile YAML/structure, missing portal, invalid portal YAML/structure, invalid workspace, unavailable scanner, and mixed failures.
  - [x] Add `career-ops-wrapper/src/services/scan-readiness-service.ts`.
  - [x] Reuse `getWorkspaceHealth(config.workspace)` and `getScriptReadiness(config.workspace)` for workspace/scanner checks.
  - [x] Reuse existing read-only paths by calling `createCvService(config).getCv()`, `createProfileService(config).getProfile()`, and `createPortalService(config).getPortals()`; do not duplicate YAML parsing, path containment, size validation, or source revision hashing.
  - [x] Convert caught `ApiError`s into readiness check failures instead of throwing for expected input readiness failures. Preserve unexpected non-`ApiError` failures as typed `UNEXPECTED_ERROR` check details or mapped service failure, without leaking raw error messages.
  - [x] Set `status = "ready"` and `canStartScan = true` only when wrapper, workspace, scanner, CV, profile, and portal checks are all ready.
  - [x] Include provenance where available: `computedAt`, per-input `sourceRevision`, and per-input `updatedAt` for CV/Profile/Portal; do not include raw file paths or file contents.
  - [x] Do not call `saveCv`, `saveProfile`, `savePortals`, `writeWorkspaceFileSafely`, `runScan`, child processes, parsers, offer projection, or filesystem writes.

- [x] Add protected scan readiness route (AC: 1, 5, 6, 8, 9)
  - [x] RED: add Fastify route tests for `GET /api/v1/scan-readiness`, ready response, not-ready response, token protection in LAN/private mode, and generic command endpoints still returning 404.
  - [x] Add `career-ops-wrapper/src/api/scan-readiness-routes.ts`.
  - [x] Register the route from `career-ops-wrapper/src/api/register-routes.ts` under the existing `/api/v1` prefix after `registerLocalPairingTokenGuard()` so it inherits protection like CV/Profile/Portal routes.
  - [x] Keep the route thin: call `ScanReadinessService`, parse `ScanReadinessDtoSchema`, return the DTO.
  - [x] Do not modify `GET /api/v1/health` behavior except where tests prove an existing contract must remain stable.

- [x] Update OpenAPI documentation (AC: 7, 9)
  - [x] RED: update OpenAPI tests to expect `/api/v1/scan-readiness`, `ScanReadinessDto`, ready/not-ready examples, security requirement, successful response, and typed 401/403/503/500 error responses.
  - [x] Update `career-ops-wrapper/src/openapi/openapi-document.ts` using existing `z.toJSONSchema()` conversion.
  - [x] Add a `Scan Readiness` tag or equivalent concise tag following current OpenAPI style.
  - [x] Do not document scan start, scan-runs, offers, reports, artifacts, or generic command endpoints in this story.

- [x] Add readiness fixture coverage and regression checks (AC: 3, 4, 5, 8, 9)
  - [x] Use existing fixture workspaces where possible: `valid-career-ops-config-profile`, `missing-scan-script`, `missing-portals-yml`, and existing temporary workspace helpers.
  - [x] Add only the smallest extra fixtures needed for invalid profile/portal and mixed-failure cases; prefer temporary workspaces in tests when cheaper than committing fixtures.
  - [x] Assert readiness checks do not mutate CV/Profile/Portal files by comparing file content before and after invalid readiness checks.
  - [x] Assert serialized readiness/error responses do not contain workspace absolute paths, CV markdown, raw YAML, local pairing token values, or raw config content.

- [x] Run validation and update implementation notes (AC: 9)
  - [x] Follow TDD: add failing focused tests first, confirm red, then implement.
  - [x] Run focused tests for contract, service, route, and OpenAPI.
  - [x] Run `npm test` from `career-ops-wrapper`.
  - [x] Run `npm run build` from `career-ops-wrapper`.
  - [x] Update this story's Dev Agent Record, File List, and task checkboxes only after validation passes.

### Review Findings

- [x] [Review][Patch] Readiness computation performs a filesystem write [/Users/dthuy/Workspace/jobflow/career-ops-wrapper/src/services/scan-readiness-service.ts:55]
- [x] [Review][Patch] Input failure messages are not distinct by failure category [/Users/dthuy/Workspace/jobflow/career-ops-wrapper/src/services/scan-readiness-service.ts:119]
- [x] [Review][Patch] Outside-workspace and unreadable input failures lose stable category keys [/Users/dthuy/Workspace/jobflow/career-ops-wrapper/src/services/scan-readiness-service.ts:128]
- [x] [Review][Patch] Scanner not-ready example exposes `scan.mjs` and drifts from runtime keys [/Users/dthuy/Workspace/jobflow/career-ops-wrapper/contracts/examples/scan-readiness.not-ready.json:27]
- [x] [Review][Patch] Overall readiness status is derived from `missingRequirements` instead of check status [/Users/dthuy/Workspace/jobflow/career-ops-wrapper/src/services/scan-readiness-service.ts:38]

## Dev Notes

### Backend Context

- The Wrapper Backend is a Node/TypeScript ESM Fastify app under `career-ops-wrapper`.
- Runtime dependencies are already installed: Fastify 5, Zod 4, `js-yaml`, `dotenv`, and Scalar docs UI. Do not add dependencies for this story.
- TypeScript is strict with `NodeNext`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`; preserve existing ESM import style.
- Existing routes are mounted under `/api/v1`; `health` is public, and CV/Profile/Portal routes are protected by `registerLocalPairingTokenGuard()` in LAN/private mode.
- Zod schemas are the API contract source; OpenAPI generation lives in `career-ops-wrapper/src/openapi/openapi-document.ts`.

### Recommended ScanReadinessDto Shape

Use the smallest DTO that supports Android gating and clear messages:

```ts
{
  status: "ready" | "notReady";
  canStartScan: boolean;
  computedAt: string;
  checks: Array<{
    name: "wrapper" | "workspace" | "scanner" | "cv" | "profile" | "portal";
    status: "ready" | "notReady";
    message: string;
    requirement?: string;
    sourceRevision?: string;
    updatedAt?: string | null;
    details?: {
      code?: ErrorCode;
      missingRequirements?: string[];
    };
  }>;
  missingRequirements: string[];
}
```

Guidance:

- `canStartScan` must be `true` only when `status` is `ready`.
- `missingRequirements` should contain stable keys Android can map, e.g. `workspace`, `scanner.scan-script`, `cv`, `profile.validation`, `portal.missing`.
- `computedAt` must be the service computation time as ISO datetime.
- `sourceRevision` and `updatedAt` come from existing CV/Profile/Portal DTOs when those checks are ready.
- Do not add raw paths, raw YAML, CV markdown, token values, stack traces, or command args to `details`.
- Prefer exact enums over arbitrary strings so Android DTOs can be tested against checked-in examples.

### Existing Code To Reuse

- `career-ops-wrapper/src/services/health-service.ts` already composes workspace and local scanner readiness through `getWorkspaceHealth()` and `getScriptReadiness()`. Reuse those functions instead of introducing a second workspace/scanner detector.
- `career-ops-wrapper/src/career-ops-engine/script-readiness.ts` already checks `doctor.mjs`, `scan.mjs`, and `portals.yml`/`portals.yaml` inside the workspace and returns missing/invalid scanner prerequisites without provider API-key requirements.
- `career-ops-wrapper/src/workspace/workspace-health.ts` already validates workspace existence, readability, writability, listability, and basic Career Ops structure without leaking absolute paths.
- `career-ops-wrapper/src/services/cv-service.ts` already reads and validates `cv.md`, including 512 KiB limit, nonblank content, `sourceRevision`, and `updatedAt`.
- `career-ops-wrapper/src/services/profile-service.ts` already reads and normalizes Profile Config and maps malformed YAML/structure to typed `ApiError`s.
- `career-ops-wrapper/src/services/portal-service.ts` already reads and normalizes Portal Config, includes read-after-write-safe source metadata, and has review fixes for validation details and duplicate IDs.
- `career-ops-wrapper/src/errors/api-error.ts` and `src/errors/error-mapper.ts` define the stable typed error envelope. For readiness checks, expected missing/invalid inputs should become check failures; unexpected route-level failures still use the mapper.

### Behavior Rules

- Readiness is a read-only computation. It must not repair, rewrite, create, back up, format, or delete workspace files.
- A workspace can be structurally ready while an input is semantically invalid; readiness must report the specific input failure, not collapse everything into generic workspace not-ready.
- Mixed failures should return all practical failures in one response so Android can show a checklist rather than one error at a time.
- If workspace health is missing/invalid, do not let downstream file-service failures leak paths or noisy stack details. It is acceptable to still compute scanner/input checks if they safely return sanitized failures, but the final readiness remains not ready.
- Do not treat stale Android cache as enabling scan start. This backend response is the fresh source of truth for scan gating.
- Do not expose generic `/run`, `/exec`, `/command`, shell command strings, executable paths, script paths, or user-selectable command args.
- Do not start scan execution in this story. Epic 4 owns run IDs, process spawning, single-active-run enforcement, persisted run state, logs, and parser/projection follow-up.

### Current Files Likely To Update

- Add:
  - `career-ops-wrapper/src/contracts/scan-readiness-contract.ts`
  - `career-ops-wrapper/src/services/scan-readiness-service.ts`
  - `career-ops-wrapper/src/api/scan-readiness-routes.ts`
  - `career-ops-wrapper/contracts/examples/scan-readiness.ready.json`
  - `career-ops-wrapper/contracts/examples/scan-readiness.not-ready.json`
  - `career-ops-wrapper/test/scan-readiness-contract.test.ts`
  - `career-ops-wrapper/test/scan-readiness-service.test.ts`
  - `career-ops-wrapper/test/scan-readiness-route.test.ts`
- Update:
  - `career-ops-wrapper/src/contracts/index.ts`
  - `career-ops-wrapper/src/api/register-routes.ts`
  - `career-ops-wrapper/src/openapi/openapi-document.ts`
  - `career-ops-wrapper/test/openapi-document.test.ts`
  - existing contract/example aggregate tests if they enumerate examples.

### Previous Story Intelligence

- Story 3.1 added read-only Portal Config contract, adapter, service, route, OpenAPI, and strict validation. Reuse `PortalService.getPortals()` rather than reading `portals.yml` directly.
- Story 3.1 review hardened malformed parent sections, malformed optional fields, location trimming/deduplication, unreadable file coverage, and uppercase HTTP URL handling. Readiness must inherit those behaviors through the existing service.
- Story 3.2 added safe Portal Config save and review fixes. Readiness must not call save paths or safe writers.
- Story 3.2 review fixed Portal validation details, generic payload-too-large wording, salary currency-only hidden state, and duplicate company/query IDs. If readiness surfaces validation details, keep them sanitized and compact.
- Story 2.4 established safe Profile Config save and read-after-write behavior; do not duplicate profile adapters or write logic.
- Current worktree may include uncommitted story 3.2 changes. Treat them as current source and do not revert them.

### Testing Requirements

- Use Vitest and existing flat `career-ops-wrapper/test/` style.
- Required focused assertions:
  - Ready fixture returns `status: "ready"`, `canStartScan: true`, six ready checks, `computedAt`, and input provenance.
  - Missing/blank/oversized CV returns not ready with a CV-specific requirement and no CV markdown in response.
  - Missing profile and invalid profile YAML/structure return profile-specific not-ready checks and do not modify profile files.
  - Missing portal and invalid portal YAML/structure return portal-specific not-ready checks and do not modify portal files.
  - Missing or invalid scanner prerequisite returns scanner-specific not-ready check using existing script readiness names.
  - Invalid workspace returns workspace-specific not-ready check and no absolute path leakage.
  - Mixed failures include multiple check failures in one DTO.
  - LAN/private mode requires `X-Career-Ops-Token` for `GET /api/v1/scan-readiness`.
  - `GET /api/v1/health` remains public.
  - `/api/v1/run`, `/api/v1/exec`, and `/api/v1/command` remain 404.
  - OpenAPI includes readiness endpoint/schema/examples and no future scan start/offers/reports/artifacts endpoints.

Minimum validation:

```bash
cd career-ops-wrapper
npm test
npm run build
```

### Latest Technical Notes

- No web/latest-version research is required for this story because it adds no dependency and does not upgrade Fastify, Zod, TypeScript, Vitest, or `js-yaml`.
- Use existing Zod 4 and `z.toJSONSchema()` OpenAPI pattern; do not add `zod-to-json-schema`.
- Use existing Node `fs/promises` only through current adapters/services where possible.

## Project Structure Notes

- Primary backend code lives in `/Users/dthuy/Workspace/jobflow/career-ops-wrapper/src`.
- Existing fixture workspaces live under `/Users/dthuy/Workspace/jobflow/career-ops-wrapper/fixtures/workspaces`.
- Real Career Ops workspace files are external inputs and must not be rewritten by tests. Use fixture or temporary workspaces.
- Backend tests currently pass with one flat `career-ops-wrapper/test/` directory; keep the local pattern.

## References

- `_bmad-output/planning-artifacts/epics.md` lines 622-633 - Epic 3 objective and risk gates.
- `_bmad-output/planning-artifacts/epics.md` lines 753-788 - Story 3.4 acceptance criteria.
- `_bmad-output/planning-artifacts/epics.md` lines 1596-1608 - implementation guardrails for readiness provenance, stale readiness, and no generic commands.
- `_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/prd.md` lines 283-290 - FR-10 scan readiness consequences.
- `_bmad-output/planning-artifacts/architecture.md` lines 300-318 - critical API, file safety, scan, and error-contract decisions.
- `_bmad-output/planning-artifacts/architecture.md` lines 568-579 - backend module boundaries.
- `_bmad-output/project-context.md` - backend stack, strict TypeScript, Zod/OpenAPI, and no new backend framework/dependency guidance.
- `_bmad-output/implementation-artifacts/3-1-read-and-validate-portal-config.md` - Portal read patterns and review fixes.
- `_bmad-output/implementation-artifacts/3-2-save-portal-config-safely.md` - Portal save patterns and review fixes.
- `career-ops-wrapper/src/services/health-service.ts` - existing health/workspace/script readiness composition.
- `career-ops-wrapper/src/career-ops-engine/script-readiness.ts` - local scan script prerequisite checks.
- `career-ops-wrapper/src/services/cv-service.ts`, `profile-service.ts`, `portal-service.ts` - existing read/normalize source-of-truth services.

## Dev Agent Record

### Agent Model Used

Codex GPT-5

### Debug Log References

- 2026-06-27: RED contract test failed because `ScanReadinessDtoSchema` and scan-readiness examples did not exist.
- 2026-06-27: RED service test failed because `scan-readiness-service` did not exist.
- 2026-06-27: RED route test failed with 404 for `/api/v1/scan-readiness`.
- 2026-06-27: RED OpenAPI test failed because `/api/v1/scan-readiness`, `ScanReadinessDto`, and examples were absent.
- 2026-06-27: Full test initially caught `cv.md` in the public OpenAPI not-ready example; replaced it with stable key `cv`.
- 2026-06-27: Code review patch tests failed for write-probe usage and generic outside-workspace/unreadable readiness responses, then passed after service/helper fixes.

### Completion Notes List

- Added typed `ScanReadinessDto` contract, checked-in ready/not-ready examples, and aggregate example validation.
- Added read-only `ScanReadinessService` that composes existing workspace health, script readiness, CV, Profile, and Portal read services without duplicating parsing/path logic or calling save/write/scan paths.
- Added protected `GET /api/v1/scan-readiness` under `/api/v1`; LAN/private mode requires Local Pairing Token while health remains public.
- Updated OpenAPI with `Scan Readiness` tag, endpoint, schema, examples, security, and typed error responses; no scan start/run/offers/reports/artifacts/generic command APIs were documented.
- Validation passed: focused readiness/OpenAPI tests, full `npm test` (28 files, 231 tests), `npm run build`, and `git diff --check`.
- Resolved all 5 code review patch findings: scan readiness now skips workspace write probes, derives overall readiness from check status, uses distinct sanitized input messages and keys, and keeps scanner details on stable requirement keys.
- Post-review validation passed: focused review regression tests, full `npm test` (28 files, 234 tests), `npm run build`, and `git diff --check`.

### File List

- _bmad-output/implementation-artifacts/3-4-compute-scan-readiness-from-workspace-inputs.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- career-ops-wrapper/contracts/examples/scan-readiness.ready.json
- career-ops-wrapper/contracts/examples/scan-readiness.not-ready.json
- career-ops-wrapper/src/api/register-routes.ts
- career-ops-wrapper/src/api/scan-readiness-routes.ts
- career-ops-wrapper/src/contracts/index.ts
- career-ops-wrapper/src/contracts/scan-readiness-contract.ts
- career-ops-wrapper/src/openapi/openapi-document.ts
- career-ops-wrapper/src/services/scan-readiness-service.ts
- career-ops-wrapper/src/workspace/workspace-health.ts
- career-ops-wrapper/test/contract-examples.test.ts
- career-ops-wrapper/test/openapi-document.test.ts
- career-ops-wrapper/test/scan-readiness-contract.test.ts
- career-ops-wrapper/test/scan-readiness-route.test.ts
- career-ops-wrapper/test/scan-readiness-service.test.ts

## Change Log

- 2026-06-27: Created backend-only scan readiness story from Epic 3 Story 3.4, PRD FR-10, architecture readiness/error/contract guardrails, and completed CV/Profile/Portal backend read-save stories.
- 2026-06-27: Implemented backend scan readiness contract, service, protected route, OpenAPI docs, examples, and regression tests; moved story to review.
- 2026-06-27: Addressed all code review patch findings and moved story to done.
