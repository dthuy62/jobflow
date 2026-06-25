---
created: 2026-06-24
story_key: 2-1-read-cv-markdown-from-career-ops-workspace
owner: Codex
baseline_commit: 0a383393122068fdf0b048c2b365d46677e5b6f1
---

# Story 2.1: Shared File Safety and CV Markdown Read/Write

Status: done

<!-- Backend-only batch story. This intentionally covers Epic 2 Story 2.1 plus the minimal CV write foundation from Story 2.2 so the shared safe-file path is built once. Do not touch Android. -->

## Story

As a personal mobile app user,
I want the Wrapper Backend to read and safely save my Career Ops CV Markdown,
so that Android can review and update the real `cv.md` used by Career Ops without corrupting the previous version.

## Acceptance Criteria

1. Given the Wrapper Backend is connected to a valid Career Ops Workspace, when `GET /api/v1/cv` is called, then the backend reads only the fixed workspace `cv.md` file and returns a `CvDto` with `markdown`, `sizeBytes`, optional `updatedAt`, and optional `sourceRevision`.
2. Given `cv.md` exists and is readable, when `GET /api/v1/cv` is called, then the response includes the Markdown content unchanged and validates against the backend Zod CV schema and checked-in contract example.
3. Given `cv.md` is missing or not readable, when `GET /api/v1/cv` is called, then the backend returns a typed `NOT_FOUND` or `WORKSPACE_UNHEALTHY` error suitable for Android not-ready handling without exposing local absolute paths.
4. Given Android submits updated CV Markdown to `PUT /api/v1/cv`, when the payload is blank after trimming or exceeds 512 KiB UTF-8, then the backend returns `VALIDATION_ERROR` or `PAYLOAD_TOO_LARGE` and does not modify the existing `cv.md`.
5. Given a valid `PUT /api/v1/cv` request is received, when the backend writes the file, then it writes only inside the configured Career Ops Workspace, preserves or backs up the previous known-good `cv.md`, performs a safer replace and read-after-write verification, and returns the saved `CvDto`.
6. Given the CV write operation fails after a previous `cv.md` exists, when the failure is handled, then the previous known-good CV remains available and the error response contains no full CV content, token value, or local absolute path.
7. Given malicious input attempts path traversal, absolute path targeting, command-like strings, or unsupported file-upload behavior, when CV read/write endpoints run, then no user-provided path or command is accepted and no out-of-workspace read/write or command execution occurs.
8. Given backend validation runs, when this story is complete, then focused CV contract, route, service/adapter, mutation-safety, OpenAPI, and regression tests pass with `npm test` and `npm run build` from `career-ops-wrapper`.

## Tasks / Subtasks

- [x] Add CV contract and examples. (AC: 1, 2, 4, 8)
  - [x] RED: add failing contract/example tests for a valid `CvDto`, validation error, payload-too-large behavior, and missing CV error coverage.
  - [x] Add `career-ops-wrapper/src/contracts/cv-contract.ts` with `CvDtoSchema` and `SaveCvRequestDtoSchema`.
  - [x] Export CV schemas/types from `career-ops-wrapper/src/contracts/index.ts`.
  - [x] Add minimal checked-in examples under `career-ops-wrapper/contracts/examples/`, including a valid CV response and relevant error examples if not already covered.

- [x] Add minimal shared safe file write helper. (AC: 4, 5, 6, 7, 8)
  - [x] RED: add failing workspace mutation-safety tests proving invalid input does not modify `cv.md`, valid writes preserve a backup or previous recoverable copy, read-after-write returns saved content, and simulated write failure keeps the previous file.
  - [x] Add `career-ops-wrapper/src/workspace/safe-file-adapter.ts`.
  - [x] Reuse `resolveWorkspaceRoot()` and `isInsidePath()` from `workspace/workspace-paths.ts` for containment checks.
  - [x] Keep the helper fixed-purpose and file-based: validate resolved target path, write a temporary file in the same workspace directory, replace the target, and provide backup/preservation semantics. Do not add a generic file manager or user-selectable paths.
  - [x] Ensure errors use existing `ApiError` codes and do not include file content or absolute local paths.

- [x] Add CV workspace adapter/service. (AC: 1, 2, 3, 4, 5, 6, 7, 8)
  - [x] RED: add failing tests for reading existing `cv.md`, missing `cv.md`, blank save, oversized save, valid save, and command-like Markdown content being treated as plain text.
  - [x] Add `career-ops-wrapper/src/workspace/cv-file-adapter.ts` for fixed `cv.md` reads/writes.
  - [x] Add `career-ops-wrapper/src/services/cv-service.ts` to orchestrate validation, adapter calls, and `CvDto` mapping.
  - [x] Use UTF-8 byte length for `sizeBytes` and the 512 KiB limit.
  - [x] Use a stable non-path `sourceRevision` such as a content hash prefix; do not expose local file paths.

- [x] Add CV routes under `/api/v1`. (AC: 1, 2, 3, 4, 5, 7, 8)
  - [x] RED: add failing Fastify injection tests for `GET /api/v1/cv` and `PUT /api/v1/cv`, including LAN/private token protection inherited from the existing guard.
  - [x] Add `career-ops-wrapper/src/api/cv-routes.ts`.
  - [x] Register CV routes from `career-ops-wrapper/src/api/register-routes.ts` using the existing `/api/v1` prefix.
  - [x] Keep routes as HTTP mapping only: parse input, call `CvService`, return parsed DTO. No filesystem logic in route handlers.
  - [x] Ensure `/run`, `/exec`, `/command`, and arbitrary command bodies remain unregistered.

- [x] Update OpenAPI for the implemented CV surface only. (AC: 1, 2, 3, 4, 5, 8)
  - [x] RED: update failing OpenAPI tests to expect `/api/v1/cv`, `CvDto`, request schema, and checked-in examples.
  - [x] Update `career-ops-wrapper/src/openapi/openapi-document.ts` using existing `z.toJSONSchema()` conversion.
  - [x] Document `GET /api/v1/cv` and `PUT /api/v1/cv`; do not document Profile, Portal, Scan, Offer, Report, Artifact, or CV conversion endpoints in this story.

- [x] Run validation and close story tasks. (AC: 8)
  - [x] Run focused tests during TDD after each behavior turns green.
  - [x] Run `npm test` from `career-ops-wrapper`.
  - [x] Run `npm run build` from `career-ops-wrapper`.
  - [x] Update this story's Dev Agent Record, File List, and task checkboxes only after all validation passes.

## Dev Notes

### Scope Boundaries

- Backend only. Do not touch `android/`.
- This story covers CV read/write only. Do not implement Profile, Portal, scan-runs, offers, reports, artifacts, CV conversion, Android UI, Room cache, auth redesign, or a generic file manager.
- `cv.md` is a fixed workspace file. API payloads must not accept file paths, filenames, commands, upload format flags, or workspace paths.
- Markdown content can contain command-like text; treat it as inert text and never execute or parse it as a shell command.

### Current Backend Patterns to Reuse

- `career-ops-wrapper/src/server.ts` creates Fastify, sets the shared error handler with `mapErrorToResponse()`, registers docs, then registers API routes.
- `career-ops-wrapper/src/api/register-routes.ts` mounts API routes under `/api/v1` and installs `registerLocalPairingTokenGuard()`. CV routes should be registered there, inside the existing prefix.
- `career-ops-wrapper/src/api/health-routes.ts` shows the route pattern: call a service and parse the response DTO with Zod before returning it.
- `career-ops-wrapper/src/contracts/index.ts` re-exports contract modules. Add CV exports there.
- `career-ops-wrapper/src/openapi/openapi-document.ts` currently builds OpenAPI 3.1 from Zod schemas via `z.toJSONSchema()` and checked-in JSON examples. Extend this file; do not introduce a second OpenAPI generator.
- `career-ops-wrapper/src/errors/api-error.ts` and `src/errors/error-mapper.ts` already map stable error codes to HTTP statuses. Reuse existing codes: `VALIDATION_ERROR`, `PAYLOAD_TOO_LARGE`, `NOT_FOUND`, `WORKSPACE_UNHEALTHY`, `PATH_OUTSIDE_WORKSPACE`, and `UNEXPECTED_ERROR`.
- `career-ops-wrapper/src/workspace/workspace-paths.ts` exposes `resolveWorkspaceRoot()` and `isInsidePath()`. Use these for write containment. Existing `security/path-guard.ts` is useful for existing readable files, but it maps missing paths to `PATH_OUTSIDE_WORKSPACE`, so do not force CV write creation through it.

### Contract Requirements

`CvDto` follows the architecture schema:

```ts
{
  markdown: string;
  sizeBytes: number;
  updatedAt?: string | null;
  sourceRevision?: string;
}
```

- `markdown` is required and non-empty in successful `GET /cv` and `PUT /cv` responses.
- `markdown` maximum is 512 KiB measured as UTF-8 bytes, not JavaScript string length.
- `sizeBytes` is a non-negative integer and must match UTF-8 byte length.
- `updatedAt` is optional ISO-8601 UTC or `null`.
- `sourceRevision` is optional and must not reveal local filesystem paths. A hash-derived value is enough.
- Success responses return `CvDto` directly. Do not wrap success in `{ success, data }`.
- Error responses use the existing `{ error: { code, message, details? } }` envelope.

### Safe File Semantics

- Reads and writes must stay inside the configured Career Ops Workspace.
- Valid save flow should be: validate request DTO -> resolve fixed target under workspace -> preserve/backup current target when present -> write temporary file in the same directory -> replace target -> read back -> return `CvDto`.
- Invalid input must fail before touching the filesystem.
- Failed writes must leave the previous `cv.md` available when it existed.
- Backup naming must not be part of the API contract. Keep it internal and deterministic enough for tests.
- Do not log or return full CV content, token values, or local absolute paths.

### Testing Requirements

- Use Vitest. Follow strict TDD: write the failing test first and verify it fails before production code.
- Add or update tests in the existing flat `career-ops-wrapper/test/` style unless a small subfolder already exists for the target area.
- Required focused coverage:
  - CV schema accepts valid response and rejects blank/oversized save payloads.
  - Contract examples parse with Zod.
  - `GET /api/v1/cv` returns a valid DTO for a fixture workspace.
  - Missing `cv.md` maps to a typed error, not an unhandled exception.
  - `PUT /api/v1/cv` rejects blank/oversized payloads without modifying existing `cv.md`.
  - Valid `PUT /api/v1/cv` writes, verifies read-after-write, and returns the saved DTO.
  - Simulated write failure preserves previous `cv.md`.
  - CV endpoints inherit Local Pairing Token protection in LAN/private mode; public `/health` behavior remains unchanged.
  - Generic command endpoints remain 404.
  - OpenAPI includes only health plus the implemented CV endpoints after this story.

Minimum validation:

```bash
cd career-ops-wrapper
npm test
npm run build
```

### Project Structure Notes

Expected files to add:

- `career-ops-wrapper/src/contracts/cv-contract.ts`
- `career-ops-wrapper/src/api/cv-routes.ts`
- `career-ops-wrapper/src/services/cv-service.ts`
- `career-ops-wrapper/src/workspace/cv-file-adapter.ts`
- `career-ops-wrapper/src/workspace/safe-file-adapter.ts`
- CV-focused tests under `career-ops-wrapper/test/`
- CV examples under `career-ops-wrapper/contracts/examples/`

Expected files to update:

- `career-ops-wrapper/src/contracts/index.ts`
- `career-ops-wrapper/src/api/register-routes.ts`
- `career-ops-wrapper/src/openapi/openapi-document.ts`
- Existing contract/OpenAPI/route tests as needed.

### Previous Story Intelligence

- Story 1.3 established workspace/script readiness and fixed file validation. Preserve readiness behavior and do not loosen workspace validation.
- Story 1.7 established `/docs` and `/openapi.json`; keep docs public as already designed, and use checked-in examples for OpenAPI.
- Recent backend commits favor small modules, Zod contracts, Fastify injection tests, and no generic command endpoint.
- Story 1.4 Android is complete, but this story must not modify Android DTOs or UI.

### Latest Technical Notes

- Fastify 5 route validation uses JSON Schema, and the current code already chooses explicit Zod parsing plus OpenAPI JSON Schema export. Keep that local pattern.
- Zod 4 has first-party `z.toJSONSchema()`, already used in `openapi-document.ts`; do not add `zod-to-json-schema`.
- Node `fs/promises` is the correct built-in API for file operations here. Use same-directory temporary writes plus rename/replace semantics where practical; no new dependency is needed for this MVP helper.

### References

- [Epic 2 Story 2.1 and 2.2](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/epics.md:373)
- [Architecture API Contract Schemas - CvDto](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/architecture.md:1387)
- [Architecture API Response Formats](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/architecture.md:608)
- [Architecture Backend Module Boundaries](/Users/dthuy/Workspace/jobflow/_bmad-output/planning-artifacts/architecture.md:992)
- [Project Context Backend Stack](/Users/dthuy/Workspace/jobflow/_bmad-output/project-context.md:31)
- [Fastify Validation and Serialization](https://fastify.io/docs/latest/Reference/Validation-and-Serialization/)
- [Zod JSON Schema](https://zod.dev/json-schema)
- [Node.js File System](https://nodejs.org/api/fs.html)

## Change Log

- 2026-06-24: Created backend-only batch story for shared file safety and CV Markdown read/write, using the existing 2.1 sprint key so dev-story can auto-discover it.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npm test -- cv-contract.test.ts` (RED: failed before CV schema/examples existed)
- `npm test -- cv-contract.test.ts` (GREEN)
- `npm test` (100 tests passing after CV contract/examples)
- `npm test -- safe-file-adapter.test.ts` (RED: failed before safe-file adapter existed)
- `npm test -- safe-file-adapter.test.ts` (GREEN)
- `npm test` (103 tests passing after safe-file adapter)
- `npm test -- cv-service.test.ts` (RED: failed before CV service existed)
- `npm test -- cv-service.test.ts` (GREEN)
- `npm test` (108 tests passing after CV service/adapter)
- `npm test -- cv-route.test.ts` (RED: `/api/v1/cv` returned 404 before routes were registered)
- `npm test -- cv-route.test.ts` (GREEN)
- `npm test` (112 tests passing after CV routes)
- `npm test -- openapi-document.test.ts` (RED: OpenAPI did not yet include CV path/schema/examples)
- `npm test -- openapi-document.test.ts` (GREEN)
- `npm test` (112 tests passing after CV OpenAPI update)
- `npm test -- cv-route.test.ts` (RED: oversized CV payload returned 400 before route delegated size validation to service)
- `npm test -- cv-route.test.ts` (GREEN)
- `npm test && npm run build` (112 tests passing, TypeScript build passing)
- `npm test -- cv-route.test.ts && npm test && npm run build` (113 tests passing after oversized route fix, TypeScript build passing)
- `npm test && npm run build` (118 tests passing after code review patches, TypeScript build passing)

### Completion Notes List

- Added CV Zod contracts and checked-in CV/error examples with focused contract tests.
- Added minimal safe workspace file writer with backup, temp-write, replace, path containment, and mutation-safety tests.
- Added fixed `cv.md` workspace adapter and CV service with typed validation, missing-file handling, safe save, read-after-write, and hash-based source revision.
- Added protected `GET /api/v1/cv` and `PUT /api/v1/cv` routes using existing API registration and Local Pairing Token guard.
- Added CV OpenAPI path, schemas, and examples while keeping unimplemented endpoint families out of the document.
- Completed backend-only validation with `npm test` and `npm run build`; no Android files were touched.
- Applied code review patches for symlink-safe writes, parser/body-limit error mapping, concurrent save responses, existing invalid CV reads, and CV workspace-unhealthy OpenAPI responses.

### File List

- `career-ops-wrapper/contracts/examples/cv.valid.json`
- `career-ops-wrapper/contracts/examples/errors/cv-missing.json`
- `career-ops-wrapper/contracts/examples/errors/payload-too-large.json`
- `career-ops-wrapper/src/contracts/cv-contract.ts`
- `career-ops-wrapper/src/contracts/index.ts`
- `career-ops-wrapper/src/api/cv-routes.ts`
- `career-ops-wrapper/src/api/register-routes.ts`
- `career-ops-wrapper/src/errors/error-mapper.ts`
- `career-ops-wrapper/src/services/cv-service.ts`
- `career-ops-wrapper/src/openapi/openapi-document.ts`
- `career-ops-wrapper/src/workspace/cv-file-adapter.ts`
- `career-ops-wrapper/src/workspace/safe-file-adapter.ts`
- `career-ops-wrapper/test/cv-contract.test.ts`
- `career-ops-wrapper/test/cv-route.test.ts`
- `career-ops-wrapper/test/cv-service.test.ts`
- `career-ops-wrapper/test/openapi-document.test.ts`
- `career-ops-wrapper/test/safe-file-adapter.test.ts`
- `_bmad-output/implementation-artifacts/2-1-read-cv-markdown-from-career-ops-workspace.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Review Findings

- [x] [Review][Patch] Harden safe CV writes against symlinked `cv.md` and `cv.md.bak` paths [career-ops-wrapper/src/workspace/safe-file-adapter.ts:39]
- [x] [Review][Patch] Map Fastify parser/body-limit failures to typed API errors instead of `UNEXPECTED_ERROR` [career-ops-wrapper/src/errors/error-mapper.ts:36]
- [x] [Review][Patch] Serialize same-target CV writes or verify the read-back content belongs to the current save [career-ops-wrapper/src/workspace/safe-file-adapter.ts:34]
- [x] [Review][Patch] Return typed errors for existing blank or oversized `cv.md` instead of generic Zod failures [career-ops-wrapper/src/workspace/cv-file-adapter.ts:39]
- [x] [Review][Patch] Document CV `WORKSPACE_UNHEALTHY` responses in OpenAPI [career-ops-wrapper/src/openapi/openapi-document.ts:222]
