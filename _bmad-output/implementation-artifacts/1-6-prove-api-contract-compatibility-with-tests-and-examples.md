---
baseline_commit: ad59e76d30a1d5ab38b07c09768d6eef01296337
---

# Story 1.6: Prove API Contract Compatibility with Tests and Examples

Status: done

## Story

As a personal mobile app maintainer,
I want checked-in backend contract examples and Android parsing tests,
so that API changes cannot silently break the mobile app.

## Acceptance Criteria

1. **Backend schemas validate representative contracts.** `cd career-ops-wrapper && npm test` validates success and failure examples for Health, Error, Collection, CV, Profile, Portal, Offer, ScanRun, Report, and Artifact. Failures identify the fixture and the rejected field/value clearly. Existing Health, Error, CV, Profile, Portal, and scan-readiness contracts remain compatible.
2. **Every MVP DTO family has checked-in examples.** `career-ops-wrapper/contracts/examples/` contains at least one valid JSON example for each family, plus error examples for unauthorized, validation failure, workspace not ready, path-boundary rejection, and scan conflict (including the active scan identifier where applicable). Examples contain no local paths, tokens, real profile/CV content, or secrets.
3. **Android parses the same examples.** Android unit tests load the checked-in backend examples without duplicating their JSON and parse them with the production Retrofit `kotlinx.serialization` configuration. Tests cover required-field rejection, optional fields omitted and explicit `null`, nullable values, and additive unknown fields. Required fields and wrong types fail; unknown fields are ignored intentionally because production sets `ignoreUnknownKeys = true`.
4. **Contract evolution is coupled across both clients.** A change to a Zod schema or fixture causes the backend fixture test and Android deserialization test to fail until the corresponding DTO/example is intentionally updated. No baseline or broad suppression may hide a contract failure.
5. **Real First evidence is documented.** `docs/career-ops-mobile/evidence/` contains an initial contract-compatibility note recording backend startup, a representative health response, ready/not-ready behavior, and contract-test status. It explicitly states that scan/offers are not implemented yet and contains no paths, tokens, or claims of completed scan/offer behavior.

## Tasks / Subtasks

- [x] **Inventory and stabilize the contract test harness (AC: 1, 4)**
  - [x] Extend `career-ops-wrapper/test/contract-examples.test.ts` with a table-driven registry covering every MVP contract family and readable fixture names.
  - [x] Add focused invalid cases for required fields, enum values, date/time formats, numeric bounds, and forbidden path leakage; keep Zod schemas as the source of truth.
  - [x] Export all contract schemas from `career-ops-wrapper/src/contracts/index.ts` and preserve the existing route schemas/error mapper behavior.

- [x] **Add missing backend contract schemas and fixtures (AC: 1, 2, 4)**
  - [x] Add Collection, Offer, ScanRun, Report (list/detail), and Artifact schemas under `career-ops-wrapper/src/contracts/`; do not add routes or advertise unimplemented APIs in OpenAPI as part of this story.
  - [x] Enforce the architecture contract: `/api/v1` payload conventions, camelCase, opaque IDs, ISO UTC timestamps, optional omitted-or-null fields, unknown enum values represented as `unknown`, and sanitized strings with no local paths.
  - [x] Use the architecture constraints for Offer salary bounds/currency, ScanRun status/stage/summary/failure, Report markdown only for detail, and Artifact API-relative or same-origin download URLs.
  - [x] Add valid collection/offer/scan-run/report/artifact fixtures and missing `path-outside-workspace` plus `scan-already-running` error fixtures alongside the existing examples.

- [x] **Add Android transport DTO compatibility coverage (AC: 3, 4)**
  - [x] Add only the transport DTOs needed for these contracts in the existing `me.dthuy.jobflow.data.models` structure; do not relocate the current shell/health feature or introduce Moshi. The repository currently uses Retrofit's `kotlinx.serialization` converter.
  - [x] Reuse the production `Json` configuration (including `ignoreUnknownKeys = true`) and load fixtures from `../career-ops-wrapper/contracts/examples` through a deterministic test-resource/path helper with an existence assertion. Do not maintain a second copy of fixture JSON.
  - [x] Add unit tests for Health, Error, Collection, CV, Profile, Portal, Offer, ScanRun, Report, and Artifact, including omitted/null optionals, unknown keys, missing required fields, and invalid types.

- [x] **Record evidence and verify the quality gate (AC: 5)**
  - [x] Add the redacted evidence note under `docs/career-ops-mobile/evidence/` with commands, observed health/readiness behavior, and test results; distinguish contract fixtures from live scan/offers evidence.
  - [x] Run `cd career-ops-wrapper && npm test && npm run build`.
  - [x] Run `cd android && ./gradlew testDevDebugUnitTest && ./gradlew qualityCheck`; fix findings rather than adding a baseline or unrelated suppressions.

## Dev Notes

### Contract and architecture guardrails

- Zod schemas are the backend contract source of truth. Keep public payloads under `/api/v1`, camelCase, opaque identifiers, and ISO UTC timestamps. Required fields must be present and non-null; optional fields may be omitted or `null`. Unknown enum-like values must deserialize as `unknown` rather than crashing the client. [Source: `_bmad-output/planning-artifacts/architecture.md#API-Contract-Schemas`]
- Never expose workspace paths, secrets, pairing tokens, raw command output, or unsanitized CV/profile content in DTOs, errors, logs, fixture files, or artifact URLs. `PATH_OUTSIDE_WORKSPACE` is a stable sanitized error; `SCAN_ALREADY_RUNNING` is a stable conflict error with an opaque active scan ID. [Source: `docs/code-standards.md#Security-and-Privacy`; Source: `career-ops-wrapper/src/contracts/error-contract.ts`]
- Collection has required `items` and `syncedAt` plus optional `sourceRevision`. Offer, ScanRun, Report, and Artifact field constraints must follow the architecture section rather than inventing endpoint behavior. Future endpoint work belongs to Epics 4–6.

### Current implementation context

- The current backend already has Health, Error, CV, Profile, Portal, and scan-readiness contracts/examples and a passing fixture test. Extend those files instead of replacing them. The current API service exposes health only; this story must not imply that scan, offer, report, or artifact routes are implemented.
- Architecture text and older planning notes mention Moshi, but the actual Android build uses `kotlinx.serialization` with Retrofit and `Json { ignoreUnknownKeys = true }`. Preserve this working dependency choice; do not add a migration or duplicate JSON parser for this story. [Source: `android/app/src/main/java/me/dthuy/jobflow/data/remote/JobFlowApiClient.kt`; Source: `android/gradle/libs.versions.toml`]
- Follow the actual package/layout (`me.dthuy.jobflow.data.models` and existing test source sets), not the stale future `careerops` package examples in planning artifacts. Keep the Android wrapper boundary: Android talks to the wrapper API and never reads Career Ops files directly. [Source: `AGENTS.md`; Source: `android/AGENTS.md`]
- Story 1.5 has been committed on `main`; preserve its health/session/shell behavior and existing tests while extending fixture coverage. Do not edit generated/build outputs.

### Testing standards

- Prefer table-driven Vitest cases with fixture path in the assertion message. Assert both positive parses and the intended failure category; do not merely assert that a test throws.
- Android tests must exercise the same parser configuration used by Retrofit and must prove fixture coupling. A stable repository-relative helper or checked-in test resource is acceptable; duplicating JSON is not.
- Run the wrapper tests/build and Android unit tests/`qualityCheck` before handing off. If a full Android build is needed for diagnosis, use the commands in `AGENTS.md`.

### Project Structure Notes

- Backend additions belong in `career-ops-wrapper/src/contracts/`, `career-ops-wrapper/contracts/examples/`, and `career-ops-wrapper/test/`; update `src/contracts/index.ts` only for exported schemas.
- Android additions belong in the existing `android/app/src/main/java/me/dthuy/jobflow/data/models/` and matching `android/app/src/test/` packages. Do not create a second contract fixture tree.
- Evidence belongs in `docs/career-ops-mobile/evidence/`; keep it redacted and factual. No CI, hook, endpoint, Room cache, UI, or scanner implementation is part of this story.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md#Story-1.6-Prove-API-Contract-Compatibility-with-Tests-and-Examples`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#API-Contract-Schemas`]
- [Source: `_bmad-output/project-context.md`]
- [Source: `career-ops-wrapper/src/contracts/`]
- [Source: `career-ops-wrapper/test/contract-examples.test.ts`]
- [Source: `android/app/src/main/java/me/dthuy/jobflow/data/remote/JobFlowApiClient.kt`]
- [Source: `android/app/src/test/`]
- [Source: `docs/code-standards.md`]

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Implementation Plan

- Added backend Zod schemas and table-driven fixture validation first, confirming the new tests failed on missing fixtures before implementation.
- Added synthetic contract examples and sanitized error examples, then added Kotlin transport DTOs and Android tests that read those same files.
- Ran formatting, static analysis, unit tests, wrapper build, and Android assemble verification.

### Debug Log References

- Backend red phase: missing Collection/Offer/ScanRun/Report/Artifact fixtures caused 10 expected failures.
- Android red phase: missing DTOs and fixture path helper caused compilation/fixture lookup failures; corrected with production-shaped DTOs and a repository-relative helper.
- KtLint initially reported four formatting findings in the new Android test; targeted `app:runKtlintFormatOverTestSourceSet` resolved them.

### Completion Notes List

- Added Collection, Offer, ScanRun, Report, and Artifact Zod contracts and exports without adding unimplemented routes.
- Added valid fixtures for every MVP DTO family and path-boundary/scan-conflict error fixtures.
- Added Android `kotlinx.serialization` DTOs and cross-repository fixture tests for required, optional/null, unknown-field, and wrong-type behavior.
- Added redacted Epic 1 contract evidence and explicitly did not claim scan/offers implementation.
- Verification passed: wrapper 28 files/251 tests and TypeScript build; Android `qualityCheck`, `testDevDebugUnitTest`, and `assembleDevDebug`.

### File List

- `_bmad-output/implementation-artifacts/1-6-prove-api-contract-compatibility-with-tests-and-examples.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `career-ops-wrapper/src/contracts/artifact-contract.ts`
- `career-ops-wrapper/src/contracts/index.ts`
- `career-ops-wrapper/src/contracts/offer-contract.ts`
- `career-ops-wrapper/src/contracts/report-contract.ts`
- `career-ops-wrapper/src/contracts/scan-run-contract.ts`
- `career-ops-wrapper/src/contracts/shared-contract.ts`
- `career-ops-wrapper/test/contract-examples.test.ts`
- `career-ops-wrapper/contracts/examples/collection.valid.json`
- `career-ops-wrapper/contracts/examples/offer.valid.json`
- `career-ops-wrapper/contracts/examples/scan-run.running.json`
- `career-ops-wrapper/contracts/examples/report.list-item.valid.json`
- `career-ops-wrapper/contracts/examples/report.detail.valid.json`
- `career-ops-wrapper/contracts/examples/artifact.valid.json`
- `career-ops-wrapper/contracts/examples/errors/path-outside-workspace.json`
- `career-ops-wrapper/contracts/examples/errors/scan-already-running.json`
- `android/app/src/main/java/me/dthuy/jobflow/data/models/ContractDtos.kt`
- `android/app/src/test/java/me/dthuy/jobflow/careerops/ApiContractCompatibilityTest.kt`
- `docs/career-ops-mobile/evidence/epic-1-contract-compatibility.md`

## Change Log

- 2026-07-13: Implemented Story 1.6 contract schemas, shared fixtures, Android serialization tests, and evidence; status moved to review.
- 2026-07-14: Marked Story 1.6 done after owner acceptance; no code changes.
