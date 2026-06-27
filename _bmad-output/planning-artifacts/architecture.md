---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - /Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/prd.md
  - /Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/addendum.md
  - /Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/validation-report.md
  - /Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/reconcile-technical-research.md
  - /Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/research/technical-career-ops-mobile-app-research-2026-06-14.md
workflowType: 'architecture'
lastStep: 8
status: 'complete'
project_name: 'task-arena'
user_name: 'Hy'
date: '2026-06-14'
completedAt: '2026-06-15'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Step 1: Architecture Initialization

Architecture workflow initialized for Career Ops Mobile.

Confirmed input documents:

- PRD: `/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/prd.md`
- PRD Addendum: `/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/addendum.md`
- PRD Validation Report: `/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/validation-report.md`
- Technical Research Reconciliation: `/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/reconcile-technical-research.md`
- Technical Research Report: `/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/research/technical-career-ops-mobile-app-research-2026-06-14.md`

Key architecture constraints carried forward:

- Real First MVP: no mock-only completion.
- Android Kotlin/Jetpack Compose app plus Node.js/TypeScript Wrapper Backend.
- Career Ops Workspace remains source of truth.
- Android Room is a projection cache only.
- Wrapper Backend uses Fastify and Zod.
- MVP rejects concurrent scan while one scan is running.
- CV input is Markdown-only in MVP.
- Physical phone LAN mode requires a Local Pairing Token.

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

The PRD defines 20 functional requirements across seven architectural capability groups:

1. Wrapper connection and workspace health: configure endpoint, display health, and surface setup guidance.
2. CV and profile management: read/write Markdown CV and normalized Profile Config through the Wrapper Backend.
3. Portal config and search criteria: read/write normalized Portal Config and validate scan readiness.
4. Real scan execution: start a real Career Ops Scan Run, poll status, reject concurrent scans, and preserve auditability.
5. Offer review: list/detail Offers parsed from Career Ops files and cache latest Offers in Android.
6. Reports and artifacts: list/open Markdown Reports and generated Artifacts when present.
7. Android experience: preserve the existing neo-brutalist visual language and provide MVP navigation surfaces.

Architecture must optimize for the personal MVP job: update career inputs from Android, trigger a real Career Ops scan, review real offers, and preserve enough implementation evidence for portfolio use. Safety and validation are required because they protect this job, but the MVP must avoid expanding into a generic Career Ops admin console, full report manager, cloud auth system, or complete parser framework.

Architecturally, these requirements imply a bounded Android feature slice backed by a small REST API. The Android app must not mutate Career Ops files directly. The Wrapper Backend becomes the anti-corruption layer between mobile DTOs and Career Ops workspace files/scripts. The Wrapper Backend owns the workspace adapter boundary; Android must only speak in normalized DTOs and opaque backend IDs.

**Non-Functional Requirements:**

The PRD defines 9 NFRs that strongly shape architecture:

- Real Integration First requires real Career Ops scripts and files in the core flow.
- File Safety requires validation, backup, and recoverable writes for CV/Profile/Portal files.
- Workspace Boundary requires strict path containment.
- Command Allowlist forbids arbitrary shell execution.
- Privacy requires log/run redaction for CV, profile, tokens, secrets, and local workspace paths.
- Local-First Security requires localhost default and a Local Pairing Token for LAN/private network access.
- Mobile Responsiveness requires asynchronous scan status rather than blocking UI.
- Recoverability requires useful failure states and preservation of previous known-good files.
- Portfolio Readability requires architecture and trade-offs to remain understandable downstream.

These NFRs make the Wrapper Backend the highest-risk component. Architecture must specify DTO validation, safe file adapter semantics, command execution boundaries, scan run lifecycle, parser/projector behavior, error taxonomy, fixture workspace testing, and API contract versioning before implementation stories begin.

**Scale & Complexity:**

- Primary domain: Android mobile client plus local/private backend wrapper around a file-based CLI/workspace engine.
- Complexity level: medium-high.
- Estimated architectural components: Android feature layers, Room projection cache, Retrofit API client, Wrapper API layer, DTO validation layer, workspace/file adapter layer, command runner, scan run manager, parsers/projectors, artifact server, error mapper, API contract artifact, fixture workspace test suite.

The project is not enterprise-scale or multi-tenant, but it has serious correctness and privacy requirements because it handles personal CV data and executes local commands.

### Technical Constraints & Dependencies

- Android stack is constrained to the existing Kotlin/Jetpack Compose app foundation.
- Existing Android code already uses Room, Retrofit, OkHttp, Moshi, coroutines, ViewModel, StateFlow/SharedFlow-style MVI, and neo-brutalist UI components.
- Wrapper Backend is constrained to Node.js/TypeScript, with Fastify and Zod expected by PRD/addendum.
- Career Ops Workspace remains canonical; Android Room is only a projection cache.
- If Android cache and workspace disagree after refresh, the Career Ops Workspace wins.
- MVP CV input is Markdown-only, max 512 KB.
- MVP Portal Config payload max is 128 KB.
- MVP must reject concurrent scans while one scan is running.
- Concurrent scan rejection should use HTTP `409`, stable error code `SCAN_ALREADY_RUNNING`, and include the active `scanRunId` when available.
- Emulator host loopback and physical phone LAN modes are both required.
- No user accounts, no cloud identity, and no roles are required in MVP; Local Pairing Token only protects the private local/LAN API.
- Remote hosted backend, Docker packaging, PDF/DOCX conversion, phone-only runtime, full AI evaluation orchestration, and automated applications are out of MVP scope.
- Android must use opaque backend IDs for offers, reports, and artifacts; it must not send raw filesystem paths.
- The MVP API should be versioned under `/api/v1`, with stable DTO field names and an OpenAPI-style or JSON-schema-style contract derived from Zod where practical.
- The Wrapper Backend startup boundary must include workspace path, bind host, port, Local Pairing Token when LAN/private access is enabled, and health checks. It must not expose a user-configurable Career Ops command path.
- MVP scan execution uses the local Career Ops script runner inside the configured Career Ops Workspace: `node scan.mjs` or the equivalent `npm run scan`. This path is zero-token and does not require Gemini/OpenAI/Anthropic API keys.
- MVP core must not depend on `GEMINI_API_KEY` or any provider API key. The core path is real scan execution through the allowlisted local script runner, workspace file integration, parsed offers, and Android projection refresh. Native AI CLI slash-command workflows and standalone API-key evaluator scripts are optional/future adapters, not Real First MVP blockers.

### Cross-Cutting Concerns Identified

- DTO schema precision and validation for Profile, Portal, Offer, ScanRun, Report, Artifact, and shared error DTOs.
- Safe YAML/Markdown read/write, including atomic backup/write/read-after-write behavior.
- Profile and Portal screens edit MVP-owned fields only; unknown upstream fields are preserved by backend adapters where possible, but not exposed as a generic mobile config editor.
- Adapters preserve unknown semantic keys where the underlying format/parser supports round-trip safety; otherwise writes are limited to MVP-owned files/sections.
- Workspace path traversal protection for all read/write/download operations.
- Opaque backend ID resolution for offers/artifacts/reports instead of raw path access.
- Raw filesystem paths should be rejected from API inputs and redacted or relativized from logs and API errors.
- Command execution allowlist and sanitized subprocess logging. The allowlist maps typed backend operations to fixed local scripts such as `scan` -> `node scan.mjs`; Android never provides shell strings, executable names, script paths, or command arguments that select a different process.
- No generic execution endpoints such as `/run`, `/exec`, or `/command`; typed endpoints map to allowlisted operations only.
- Single active Scan Run lifecycle with API-level conflict handling.
- Scan execution is stateful and long-running, requiring an in-memory run manager plus persisted run metadata/log summary so Android can recover after app restart or reconnect.
- Command execution and result projection are separate stages; parser/projector failure must be distinguishable from scan command failure.
- Parser fallback rules must allow partial Offer projection only when required Offer fields are present; missing required fields should produce parser warnings rather than crash the entire offer list.
- Parser/projector reliability for Career Ops pipeline, tracker, scan history, reports, and artifacts.
- Configuration drift: Career Ops files may be edited outside Android, so the wrapper must always read current workspace state and Android cache must be refreshable/invalidatable.
- Android cache freshness, offline/last-known labeling, and refresh behavior. Room projection entities should carry `syncedAt`, `sourceRevision`, or an equivalent freshness signal.
- Error taxonomy shared across backend and Android UI: validation, workspace health, unauthorized, scan conflict, command failure, parser failure, not found, and unexpected.
- Reports/artifacts are view-if-present in MVP; they support portfolio value but are secondary to the scan/offers core loop.
- Real First evidence gate: MVP is not complete until one end-to-end flow proves Android -> Wrapper API -> real Career Ops workspace read/write -> real scan command -> parsed offers/reports if present -> Android Room projection refresh.
- Test fixture strategy using real or realistic Career Ops workspaces, including successful scan, failed scan, malformed config, unknown YAML fields, oversized payload, missing files, missing report/artifact, artifact path outside workspace, corrupted tracker file, command non-zero exit, partial output written, and concurrent scan conflict.
- Golden fixture workspace should be versioned, for example under `fixtures/workspaces/golden`, with known CV, profile, portal config, tracker/pipeline outputs, reports, artifacts, and expected DTO snapshots.
- Backend tests must cover Zod schema validation, file adapter integration, scan manager conflict behavior, parser fixture projection, mutation safety, path traversal, token missing/invalid, command injection strings in config fields, and log redaction.
- Android tests must cover repository behavior with fake API responses, DTO deserialization/contract examples, Room cache freshness, and ViewModel MVI state transitions.
- Performance smoke expectations should ensure local health/profile/config endpoints are responsive, offer list volume remains usable, and scan polling does not spam the wrapper.

### Downstream Architecture Decisions To Capture

- ADR-001: Wrapper Backend over direct Android port.
- ADR-002: Career Ops Workspace as source of truth; Room as projection cache.
- ADR-003: Fastify + Zod API boundary and `/api/v1` contract.
- ADR-004: Safe workspace file adapter with atomic backup/write/read-after-write.
- ADR-005: Allowlisted command runner and single active scan run.
- ADR-006: Polling over WebSockets for MVP scan status.
- ADR-007: Local Pairing Token for LAN mode despite no account login.
- ADR-008: Opaque artifact/report IDs over raw file paths.
- ADR-009: Real scan/offers core through zero-token local script runner before AI CLI or API-key evaluation integration.

### Key Assumptions To Validate During Architecture

- Career Ops file locations and formats are stable enough for a wrapper adapter.
- Career Ops scanner can be invoked non-interactively for MVP through the local script runner (`node scan.mjs` / `npm run scan`) without requiring `GEMINI_API_KEY` or any provider API key.
- Career Ops pipeline/tracker files contain enough data to produce the required Offer DTO.
- Native AI CLI integrations such as Antigravity, Claude Code, Gemini CLI, Codex, OpenCode, or Qwen may be usable later through authenticated local CLI sessions, but must not be required for MVP scan/offers completion until a separate headless/non-interactive spike proves them.
- Standalone API-key evaluator scripts such as `gemini-eval.mjs` require provider API keys and should remain optional until the user chooses to add an API-key provider mode with explicit cost controls.
- Local machine running the wrapper can reach target job portals.
- The user accepts running a companion backend while using the mobile app.
- Markdown-only CV is acceptable for MVP.
- External Android intents are sufficient for opening job URLs and downloaded artifacts.

## Starter Template Evaluation

### Primary Technology Domain

Career Ops Mobile is a brownfield Android mobile app plus a new local/private API backend.

The existing Android project is already the mobile foundation and should not be replaced by a new Android starter. It provides Kotlin, Jetpack Compose, Room, Retrofit/OkHttp/Moshi, coroutines, ViewModel, MVI-style state, and neo-brutalist UI components.

The new starter decision applies to the Wrapper Backend: `career-ops-wrapper`.

### Starter Options Considered

**Option 1: Keep Existing Android Project + Custom Fastify TypeScript Wrapper Scaffold**

Use the current Android app as the mobile starter and create a small purpose-built Node.js/TypeScript Fastify backend in a new `career-ops-wrapper/` directory.

This option follows official Fastify TypeScript setup guidance rather than adopting a large third-party boilerplate. It keeps the backend minimal and aligned with the project's Real First needs: workspace validation, safe file adapters, command allowlist, scan run manager, parser/projector pipeline, and API contract tests.

**Option 2: Community Fastify TypeScript Starter**

Community starters can provide hot reload, TypeScript config, route folders, Swagger, Docker, auth, database, or deployment wiring. These are useful for generic APIs, but many add features the MVP explicitly does not need: auth systems, cloud deployment, databases, Prisma/ORM layers, GraphQL, or broad production hosting assumptions.

For this project, those defaults would create architecture drift because the source of truth is the Career Ops Workspace, not a backend database.

**Option 3: NestJS with Fastify Adapter**

NestJS would provide a structured backend framework with modules, dependency injection, validation, and strong conventions. It is more framework than this personal wrapper needs. The MVP backend is a thin anti-corruption layer over workspace files and allowlisted commands, so NestJS would likely add ceremony before it adds value.

**Option 4: Direct Android-Only Starter/Port**

Rejected for MVP. Career Ops is Node/workspace/script-oriented and uses local files plus command behavior. Direct Android port would force a rewrite of unstable integration logic and would not respect the PRD's selected architecture.

### Selected Starter: Existing Android App + Custom Fastify TypeScript Wrapper Scaffold

**Rationale for Selection:**

This is the most phase-safe foundation because it preserves what already works in the Android codebase and keeps the new backend focused. It avoids replacing the mobile app, avoids overbuilt backend boilerplates, and gives architecture full control over the critical boundaries: DTO validation, file safety, workspace containment, command execution, scan lifecycle, and test fixtures.

The wrapper should be initialized manually using official Fastify + TypeScript guidance, then shaped around the project-specific modules rather than a generic web API template.

**Initialization Command:**

```bash
mkdir career-ops-wrapper
cd career-ops-wrapper
npm init -y
npm install fastify zod js-yaml dotenv
npm install -D typescript @types/node tsx vitest
npx tsc --init
```

Recommended runtime baseline:

```text
Node.js: 24 LTS
Fastify: 5.x
Zod: 4.x
TypeScript: 6.x
Vitest: 4.x
```

Versions should be pinned during implementation using the package lock generated at project initialization.

### Architectural Decisions Provided by Starter

**Language & Runtime:**

Node.js LTS with TypeScript. This aligns with Career Ops' Node.js scripts and avoids bridging the core workflow into Kotlin.

**API Framework:**

Fastify provides a lightweight HTTP API foundation without imposing a full application framework. The backend remains a focused wrapper, not a general SaaS backend.

**Validation:**

Zod is the runtime validation boundary for request DTOs, response DTOs, environment variables, and internal parsed file projections.

**YAML and Environment Support:**

`js-yaml` handles Career Ops YAML-backed profile/portal config adapters. `dotenv` supports local wrapper configuration without making secrets or local paths part of Android state.

**Build Tooling:**

TypeScript compiler plus `tsx` for local development. Keep build tooling minimal until packaging or Docker becomes necessary.

**Testing Framework:**

Vitest for backend unit and integration tests. Required early test targets include Zod schemas, file adapters, scan manager conflict behavior, parser fixtures, security guardrails, and error contract examples.

**Code Organization:**

The wrapper should be organized by architectural responsibility rather than generic MVC:

```text
career-ops-wrapper/
├── src/
│   ├── api/
│   ├── config/
│   ├── contracts/
│   ├── workspace/
│   ├── commands/
│   ├── runs/
│   ├── parsers/
│   ├── artifacts/
│   ├── security/
│   └── server.ts
├── fixtures/
│   └── workspaces/
├── test/
└── package.json
```

**Development Experience:**

Local dev runs the wrapper against an explicit Career Ops Workspace path. The first implementation story should create health/config loading, `/api/v1/health`, and fixture-backed validation before scan execution.

### Deferred Optional Adapter: MarkItDown CV Conversion

MVP core keeps CV storage as Markdown in `cv.md`; this keeps Career Ops Workspace semantics stable and avoids making document conversion a Real First blocker.

Microsoft MarkItDown is a strong candidate for an optional CV conversion adapter because it converts common document formats to Markdown and is designed for LLM/text-analysis pipelines. It should be treated as an external Python adapter, not a Node starter dependency.

Recommended scope:

- Required MVP path: `PUT /cv` accepts Markdown text and writes `cv.md` safely.
- Optional/stretch path: `POST /cv/convert` accepts PDF/DOCX upload, stores it in a bounded temp directory, runs MarkItDown, and returns Markdown preview.
- Converted Markdown is not written directly to `cv.md`; the user confirms via `PUT /cv`.
- Only local file upload conversion is allowed in MVP/stretch; no remote URL conversion.
- Supported initial conversion types should be PDF and DOCX only.
- Upload size, file extension, MIME type, temp path, subprocess execution, and output size must be validated.
- Python/venv/Docker packaging should be considered only when this adapter becomes an implementation story.

This preserves high user value for mobile CV upload while keeping the scan/offers MVP independent from Python document conversion.

**Note:**

Project initialization using this scaffold should be the first backend implementation story. Android implementation should continue inside the existing app structure rather than starting a new mobile project.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- Data ownership: Career Ops Workspace is canonical; Android Room is projection cache only.
- Wrapper architecture: Node.js/TypeScript Fastify API with Zod validation.
- API style: REST under `/api/v1`, stable DTOs, typed endpoints only.
- File safety: safe workspace adapter with path containment, backups, atomic write, read-after-write.
- Scan execution: single active Scan Run, allowlisted local script runner, persisted run metadata/log summary.
- Security: localhost default; LAN mode requires Local Pairing Token; no user accounts/cloud identity.
- Testing gate: Real First completion requires one verified Android -> Wrapper -> Career Ops -> parsed offers -> Room refresh flow.

**Important Decisions (Shape Architecture):**

- Android feature architecture follows data/domain/presentation layering with MVI ViewModel state.
- Android cache entities include freshness metadata such as `syncedAt` and source revision/hash.
- Backend distinguishes command execution failure from parser/projector failure.
- Error contract uses stable `code`, `message`, optional `details`.
- Reports/artifacts are view-if-present in MVP, not a full document library.
- MarkItDown CV conversion is optional/stretch, isolated behind a conversion adapter.

**Deferred Decisions (Post-MVP):**

- Remote private backend hosting.
- Docker packaging unless local setup becomes fragile.
- Full AI CLI or provider API-key evaluation orchestration.
- PDF/DOCX CV conversion as required path.
- WebSocket scan updates.
- Multi-user auth/roles.
- Automated job application submission.

### Data Architecture

Career Ops Workspace remains the source of truth for CV, profile, portal config, pipeline/tracker files, reports, and artifacts.

Android Room stores only projections for responsive mobile UI:

- Offers.
- Scan runs.
- Report/artifact metadata.
- Health/readiness snapshots.
- Cache freshness metadata.

If Android cache and wrapper workspace state disagree after refresh, workspace state wins.

Backend file adapters own all direct filesystem access. Android never sends raw paths and never mutates Career Ops files directly.

Profile and Portal writes use this contract:

1. Validate DTO.
2. Resolve path inside workspace.
3. Back up previous known-good file.
4. Write atomically.
5. Read back.
6. Return normalized DTO.
7. Preserve previous valid file on failure.

### Authentication & Security

MVP has no user accounts, cloud identity, roles, or login screen.

API protection is still required:

- Localhost binding by default.
- LAN mode requires a Local Pairing Token.
- The Local Pairing Token is checked on every non-health endpoint when LAN mode is enabled.
- Firebase App Check is deferred for MVP; it may be reconsidered only if the wrapper is deployed as a public/cloud backend.
- No arbitrary command endpoints.
- No raw path inputs.
- Path traversal rejection.
- Sanitized logs and API errors.
- CV/profile/token/local path redaction.

Security tests must cover path traversal, invalid token, artifact ID lookup, command injection strings, and log redaction.

### API & Communication Patterns

Android communicates with Wrapper Backend through REST JSON over HTTP for local development/LAN.

API base path: `/api/v1`.

Endpoint families:

- `GET /health`
- `GET /cv`, `PUT /cv`
- `GET /profile`, `PUT /profile`
- `GET /portals`, `PUT /portals`
- `POST /scan-runs`, `GET /scan-runs/{id}`
- `GET /offers`, `GET /offers/{id}`
- `GET /reports`, `GET /reports/{id}`
- `GET /artifacts/{id}`

Polling is selected over WebSockets for MVP scan status because it is simpler, testable, and enough for a personal local tool.

Concurrent scan rejection:

- HTTP `409`
- Error code `SCAN_ALREADY_RUNNING`
- Response includes active `scanRunId` when available.

DTO contracts are defined with Zod on backend and mirrored by Android Moshi DTOs. Architecture should produce exact schemas for Profile, Portal, Offer, ScanRun, Report, Artifact, and Error DTOs.

### Frontend Architecture

Android keeps the existing app foundation:

- Kotlin.
- Jetpack Compose.
- Room.
- Retrofit/OkHttp/Moshi.
- Coroutines/Flow.
- ViewModel.
- MVI-style state/intents/effects.
- Existing neo-brutalist UI components.

Career Ops should be added as a bounded feature slice with:

- `data`: Retrofit API, Room entities/DAO, repository implementation.
- `domain`: models, repository interface, use cases.
- `presentation`: screens, ViewModels, MVI state/intents/effects.

MVP navigation surfaces:

- Setup/connection.
- CV/profile.
- Portal config.
- Scan status.
- Offer list.
- Offer detail.
- Reports/artifacts.

### Infrastructure & Deployment

MVP deployment is local/private:

- Wrapper runs on developer/user machine.
- Android emulator uses host loopback.
- Physical phone uses trusted LAN with Local Pairing Token.
- Remote hosted backend is deferred.

Wrapper runtime baseline:

- Node.js 24 LTS.
- Fastify 5.x.
- Zod 4.x.
- TypeScript 6.x.
- Vitest 4.x.

Docker is deferred unless needed for reproducible Career Ops/MarkItDown/Playwright setup.

MarkItDown CV conversion is an optional adapter:

- Python process boundary.
- PDF/DOCX only at first.
- No URL conversion.
- Temp directory isolation.
- Preview before save.
- Not required for MVP scan/offers completion.

### Decision Impact Analysis

**Implementation Sequence:**

1. Scaffold `career-ops-wrapper`.
2. Add config/env validation and `/api/v1/health`.
3. Add workspace boundary and safe file adapter.
4. Add Profile/Portal/CV schemas and read/write endpoints.
5. Add scan run manager and allowlisted scan execution.
6. Add parser/projector for offers and scan history.
7. Add Android API/repository/Room projection layer.
8. Add Android MVI screens for setup, config, scan, offers.
9. Add reports/artifacts view-if-present.
10. Add optional MarkItDown adapter only after core scan/offers works.

**Cross-Component Dependencies:**

- Android DTOs depend on backend Zod/OpenAPI contract.
- Room cache freshness depends on wrapper source revision/hash or equivalent metadata.
- Scan UI depends on stable ScanRun state machine.
- Offer list depends on parser/projector rules and required Offer fields.
- Artifact/report views depend on opaque backend IDs.
- Real First acceptance depends on fixture workspace tests and one real end-to-end scan.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**

This architecture has 10 high-risk consistency areas where different AI agents could otherwise make incompatible choices:

1. Backend and Android DTO naming.
2. API endpoint and error response formats.
3. Room entity/table naming and cache freshness fields.
4. Workspace file adapter behavior.
5. ScanRun state naming and transitions.
6. Parser warning/error behavior.
7. Android MVI intent/state/effect naming.
8. Test fixture location and expected snapshot naming.
9. Security/log redaction behavior.
10. Optional adapter boundaries such as MarkItDown.

### Naming Patterns

**Database Naming Conventions:**

Android Room tables use `snake_case` plural table names:

- `career_offers`
- `scan_runs`
- `report_artifacts`
- `workspace_health_snapshots`

Room entity classes use Kotlin `PascalCase` with `Entity` suffix:

- `CareerOfferEntity`
- `ScanRunEntity`
- `ReportArtifactEntity`

Room columns use `camelCase` Kotlin property names and explicit `@ColumnInfo(name = "snake_case")` when database column naming matters.

Required cache freshness fields:

- `syncedAt`
- `sourceRevision`
- `isStale`

**API Naming Conventions:**

REST endpoints use plural kebab-case resources under `/api/v1`:

- `/api/v1/scan-runs`
- `/api/v1/offers`
- `/api/v1/reports`
- `/api/v1/artifacts`

Path parameters use `{id}` in documentation and `:id` in Fastify route declarations.

Query parameters use `camelCase`.

Headers:

- LAN/private access header: `X-Career-Ops-Token: <token>`
- Optional request correlation header: `X-Request-Id`

**Code Naming Conventions:**

Backend TypeScript:

- Files: `kebab-case.ts`
- Classes/types/schemas: `PascalCase`
- Functions/variables: `camelCase`
- Zod schemas: `ProfileDtoSchema`, `ScanRunDtoSchema`
- DTO types: `ProfileDto`, `ScanRunDto`

Android Kotlin:

- Files/classes/composables: `PascalCase`
- Functions/properties: `camelCase`
- ViewModels: `CareerOpsViewModel`, `OfferListViewModel`
- UI state: `OfferListUiState`
- Intents: `OfferListIntent`
- Effects: `OfferListEffect`

### Structure Patterns

**Project Organization:**

Backend wrapper modules are organized by architectural responsibility:

- `api/`: route registration and HTTP mapping only.
- `contracts/`: Zod DTO schemas and shared API contract types.
- `config/`: env loading and startup validation.
- `workspace/`: path-safe file adapters and workspace health.
- `commands/`: allowlisted Career Ops command execution.
- `runs/`: ScanRun manager and run metadata.
- `parsers/`: Career Ops pipeline/tracker/report parsers.
- `artifacts/`: artifact/report ID indexing and serving.
- `security/`: token validation, redaction, path guards.

Android Career Ops feature follows existing layers:

- `data/api`
- `data/database`
- `data/repository`
- `domain/model`
- `domain/repository`
- `domain/usecase`
- `presentation/screen/careerops/...`
- `presentation/component` for shared neo-brutalist primitives

**File Structure Patterns:**

Tests:

- Backend unit tests may be colocated as `*.test.ts` when tightly scoped.
- Backend integration/fixture tests live under `test/`.
- Fixture workspaces live under `fixtures/workspaces/`.
- Android tests follow existing `app/src/test/...` and `app/src/androidTest/...`.

Environment files:

- Wrapper uses `.env` for local config.
- `.env.example` documents required keys without secrets.
- Android stores only wrapper endpoint/token settings, never workspace paths.

### Format Patterns

**API Response Formats:**

Success responses return direct resource DTOs unless returning a collection:

```json
{
  "items": [],
  "syncedAt": "2026-06-15T10:30:00.000Z"
}
```

Error responses use a stable envelope:

```json
{
  "error": {
    "code": "SCAN_ALREADY_RUNNING",
    "message": "A scan run is already in progress.",
    "details": {
      "scanRunId": "scan_20260615_103000"
    }
  }
}
```

All API dates use ISO-8601 UTC strings.

All JSON fields use `camelCase`.

IDs are opaque strings. Android must not infer file paths or workspace structure from IDs.

**Data Exchange Formats:**

DTOs distinguish:

- Required fields for MVP rendering.
- Optional enrichment fields.
- Parser warnings.

Null handling:

- Missing optional fields may be omitted or `null`.
- Required fields must be present and valid.
- Empty strings are invalid for required user-entered fields unless explicitly allowed.

### Communication Patterns

**Event System Patterns:**

No cross-service event bus in MVP.

Internal backend run events may use these names:

- `scanRun.started`
- `scanRun.succeeded`
- `scanRun.failed`
- `scanRun.parserFailed`

These events are internal only and should map to persisted ScanRun state.

**State Management Patterns:**

Android MVI pattern:

- `UiState` contains durable screen state.
- `Intent` represents user actions or lifecycle events.
- `Effect` represents one-shot side effects such as toast, navigation, or opening external URLs.

Loading states should be explicit:

- `isLoading`
- `isSaving`
- `isPolling`
- `isRefreshing`

Do not use a single global loading flag for screens that can save and poll independently.

### Process Patterns

**Error Handling Patterns:**

Backend maps all failures to stable error codes.

Required MVP error codes:

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `WORKSPACE_UNHEALTHY`
- `NOT_FOUND`
- `SCAN_ALREADY_RUNNING`
- `COMMAND_FAILED`
- `PARSER_FAILED`
- `PATH_OUTSIDE_WORKSPACE`
- `PAYLOAD_TOO_LARGE`
- `UNEXPECTED_ERROR`

Android maps backend error codes to user-visible state and keeps technical detail available for diagnostics where useful.

Backend logs must use redaction helpers before logging user content, local paths, token values, subprocess output, or parser errors.

**Loading State Patterns:**

- Backend long-running work is represented as ScanRun resources.
- Android polls ScanRun status instead of blocking.
- Polling stops on terminal states: `succeeded`, `failed`, `cancelled`, or `unknown`.
- Cached data must be labeled stale/offline when wrapper refresh fails.

### Enforcement Guidelines

**All AI Agents MUST:**

- Use `/api/v1` endpoint family and stable DTO names from architecture.
- Route all filesystem access through backend workspace adapters.
- Never add generic command execution endpoints.
- Never make Android source-of-truth for Career Ops data.
- Add or update fixture tests when changing parser/file adapter behavior.
- Preserve MVI naming and state/effect separation in Android.
- Redact sensitive content and local paths from logs/errors.
- Treat MarkItDown/Gemini integrations as optional adapters unless a later story explicitly promotes them.

**Pattern Enforcement:**

- PR/story reviews should compare implementation against this architecture file.
- Pattern violations should be fixed in the story branch before accepting implementation.
- If a pattern needs to change, update architecture first, then stories.
- Backend contract examples should be kept in fixtures or schema snapshots.
- Android DTO deserialization tests should use the same examples.

### Pattern Examples

**Good Examples:**

- `POST /api/v1/scan-runs` creates a typed ScanRun that maps to the fixed allowlisted scanner script (`node scan.mjs`) instead of `POST /api/v1/command`.
- `CareerOfferEntity.syncedAt` records cache freshness instead of assuming Room is current.
- `PATH_OUTSIDE_WORKSPACE` is returned for traversal attempts instead of exposing the resolved local path.
- `POST /api/v1/cv/convert` returns Markdown preview and does not overwrite `cv.md`.

**Anti-Patterns:**

- Android reads or writes `portals.yml` directly.
- Backend accepts a request body like `{ "command": "npm run scan" }`.
- Backend shells out to Antigravity/Claude/Gemini/Codex slash commands from an MVP scan endpoint.
- Artifact endpoint accepts raw file paths.
- Parser crashes the entire offer list because one optional salary field is malformed.
- UI treats cached offers as fresh after wrapper refresh fails.
- MarkItDown conversion overwrites the saved CV without user confirmation.

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
task-arena/
├── app/
│   ├── build.gradle.kts
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml
│       │   ├── java/<existing-package>/
│       │   │   ├── AppContainer.kt
│       │   │   ├── MainActivity.kt
│       │   │   ├── TaskArenaApplication.kt
│       │   │   ├── careerops/
│       │   │   │   ├── data/
│       │   │   │   │   ├── api/
│       │   │   │   │   │   ├── CareerOpsApiService.kt
│       │   │   │   │   │   ├── CareerOpsAuthInterceptor.kt
│       │   │   │   │   │   └── dto/
│       │   │   │   │   │       ├── ArtifactDto.kt
│       │   │   │   │   │       ├── CvDto.kt
│       │   │   │   │   │       ├── ErrorDto.kt
│       │   │   │   │   │       ├── HealthDto.kt
│       │   │   │   │   │       ├── OfferDto.kt
│       │   │   │   │   │       ├── PortalDto.kt
│       │   │   │   │   │       ├── ProfileDto.kt
│       │   │   │   │   │       ├── ReportDto.kt
│       │   │   │   │   │       └── ScanRunDto.kt
│       │   │   │   │   ├── database/
│       │   │   │   │   │   ├── ArtifactDao.kt
│       │   │   │   │   │   ├── ArtifactEntity.kt
│       │   │   │   │   │   ├── CareerOfferDao.kt
│       │   │   │   │   │   ├── CareerOfferEntity.kt
│       │   │   │   │   │   ├── ReportDao.kt
│       │   │   │   │   │   ├── ReportEntity.kt
│       │   │   │   │   │   ├── ScanRunDao.kt
│       │   │   │   │   │   ├── ScanRunEntity.kt
│       │   │   │   │   │   ├── WorkspaceHealthDao.kt
│       │   │   │   │   │   └── WorkspaceHealthEntity.kt
│       │   │   │   │   ├── mapper/
│       │   │   │   │   │   └── CareerOpsMappers.kt
│       │   │   │   │   ├── repository/
│       │   │   │   │   │   └── CareerOpsRepositoryImpl.kt
│       │   │   │   │   └── settings/
│       │   │   │   │       └── CareerOpsSettingsDataSource.kt
│       │   │   │   ├── domain/
│       │   │   │   │   ├── model/
│       │   │   │   │   │   ├── Artifact.kt
│       │   │   │   │   │   ├── CvDocument.kt
│       │   │   │   │   │   ├── Offer.kt
│       │   │   │   │   │   ├── PortalConfig.kt
│       │   │   │   │   │   ├── ProfileConfig.kt
│       │   │   │   │   │   ├── Report.kt
│       │   │   │   │   │   ├── ScanRun.kt
│       │   │   │   │   │   ├── WorkspaceHealth.kt
│       │   │   │   │   │   └── WrapperConnectionSettings.kt
│       │   │   │   │   ├── repository/
│       │   │   │   │   │   └── CareerOpsRepository.kt
│       │   │   │   │   └── usecase/
│       │   │   │   │       ├── ConnectWrapperUseCase.kt
│       │   │   │   │       ├── GetCvUseCase.kt
│       │   │   │   │       ├── GetOffersUseCase.kt
│       │   │   │   │       ├── GetPortalConfigUseCase.kt
│       │   │   │   │       ├── GetProfileConfigUseCase.kt
│       │   │   │   │       ├── GetReportsUseCase.kt
│       │   │   │   │       ├── PollScanRunUseCase.kt
│       │   │   │   │       ├── SaveCvUseCase.kt
│       │   │   │   │       ├── SavePortalConfigUseCase.kt
│       │   │   │   │       ├── SaveProfileConfigUseCase.kt
│       │   │   │   │       └── StartScanRunUseCase.kt
│       │   │   │   └── presentation/
│       │   │   │       ├── CareerOpsNav.kt
│       │   │   │       ├── setup/
│       │   │   │       ├── cvprofile/
│       │   │   │       ├── portals/
│       │   │   │       ├── scans/
│       │   │   │       ├── offers/
│       │   │   │       └── reports/
│       │   │   ├── presentation/component/
│       │   │   │   └── NeoBrutalist.kt
│       │   │   └── ui/theme/
│       │   ├── res/
│       │   │   └── xml/
│       │   │       └── network_security_config.xml
│       │   ├── dev/
│       │   │   └── res/values/strings.xml
│       │   └── prod/
│       │       └── res/values/strings.xml
│       ├── test/java/<existing-package>/careerops/
│       │   ├── contract/
│       │   ├── repository/
│       │   ├── state/
│       │   └── viewmodel/
│       └── androidTest/java/<existing-package>/careerops/
├── career-ops-wrapper/
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── .env.example
│   ├── README.md
│   ├── contracts/
│   │   └── examples/
│   │       ├── error.scan-already-running.json
│   │       ├── error.validation.json
│   │       ├── offer-list.valid.json
│   │       ├── portal.valid.json
│   │       ├── profile.valid.json
│   │       ├── scan-run.failed.json
│   │       └── scan-run.running.json
│   ├── src/
│   │   ├── server.ts
│   │   ├── api/
│   │   │   ├── artifact-routes.ts
│   │   │   ├── cv-routes.ts
│   │   │   ├── health-routes.ts
│   │   │   ├── offer-routes.ts
│   │   │   ├── portal-routes.ts
│   │   │   ├── profile-routes.ts
│   │   │   ├── register-routes.ts
│   │   │   ├── report-routes.ts
│   │   │   └── scan-run-routes.ts
│   │   ├── career-ops-engine/
│   │   │   ├── career-ops-engine-adapter.ts
│   │   │   ├── scan-operation.ts
│   │   │   └── tool-discovery.ts
│   │   ├── config/
│   │   │   ├── cli-args.ts
│   │   │   ├── env.ts
│   │   │   └── runtime-config.ts
│   │   ├── contracts/
│   │   │   ├── artifact-contract.ts
│   │   │   ├── cv-contract.ts
│   │   │   ├── error-contract.ts
│   │   │   ├── health-contract.ts
│   │   │   ├── index.ts
│   │   │   ├── offer-contract.ts
│   │   │   ├── portal-contract.ts
│   │   │   ├── profile-contract.ts
│   │   │   ├── report-contract.ts
│   │   │   └── scan-run-contract.ts
│   │   ├── errors/
│   │   │   ├── api-error.ts
│   │   │   ├── error-code.ts
│   │   │   └── error-mapper.ts
│   │   ├── outputs/
│   │   │   ├── artifact-id.ts
│   │   │   ├── output-index.ts
│   │   │   └── report-reader.ts
│   │   ├── parsers/
│   │   │   ├── offer-projector.ts
│   │   │   ├── parser-warning.ts
│   │   │   ├── pipeline-parser.ts
│   │   │   ├── scan-history-parser.ts
│   │   │   └── tracker-parser.ts
│   │   ├── runs/
│   │   │   ├── scan-run-manager.ts
│   │   │   └── scan-run-state.ts
│   │   ├── security/
│   │   │   ├── bearer-token.ts
│   │   │   ├── path-guard.ts
│   │   │   └── redaction.ts
│   │   ├── services/
│   │   │   ├── cv-service.ts
│   │   │   ├── offer-service.ts
│   │   │   ├── portal-service.ts
│   │   │   ├── profile-service.ts
│   │   │   ├── report-service.ts
│   │   │   └── scan-run-service.ts
│   │   ├── storage/
│   │   │   ├── local-json-store.ts
│   │   │   └── run-store.ts
│   │   └── workspace/
│   │       ├── cv-file-adapter.ts
│   │       ├── portal-file-adapter.ts
│   │       ├── profile-file-adapter.ts
│   │       ├── safe-file-adapter.ts
│   │       ├── workspace-health.ts
│   │       └── workspace-paths.ts
│   ├── fixtures/
│   │   └── workspaces/
│   │       ├── command-failed-partial-output/
│   │       ├── corrupted-tracker/
│   │       ├── golden/
│   │       │   ├── expected/
│   │       │   ├── input/
│   │       │   └── output/
│   │       ├── malformed-config/
│   │       ├── missing-report-artifact/
│   │       ├── oversized-payloads/
│   │       └── traversal-attempts/
│   └── test/
│       ├── contracts/
│       ├── integration/
│       ├── parsers/
│       ├── runs/
│       │   ├── scan-run-conflict.test.ts
│       │   ├── scan-run-recovery.test.ts
│       │   └── scan-run-state-machine.test.ts
│       ├── security/
│       └── workspace/
├── docs/
│   └── career-ops-mobile/
│       ├── api-contract.md
│       ├── deferred/
│       │   └── markitdown-adapter.md
│       ├── evidence/
│       │   ├── logs-redacted/
│       │   ├── real-first-run.md
│       │   └── screenshots/
│       ├── fixture-workspaces.md
│       └── local-wrapper-setup.md
├── _bmad-output/
│   └── planning-artifacts/
│       └── architecture.md
├── gradle/
├── build.gradle.kts
├── gradle.properties
├── README.md
└── settings.gradle.kts
```

### Architectural Boundaries

**API Boundaries:**

Android communicates only with Wrapper Backend REST endpoints under `/api/v1`.

Android must not:

- Read Career Ops files directly.
- Send raw filesystem paths.
- Send command names.
- Infer artifact file locations from IDs.

Wrapper API routes only map HTTP to validated application operations. Route files do not contain filesystem, parser, or scan orchestration logic.

**Backend Module Boundaries:**

The backend has two conceptual blocks:

1. `career-ops-wrapper`: the mobile-facing wrapper API, application services, contracts, security, and error handling.
2. `career-ops-engine`: the adapter boundary to the external Career Ops scanner/tool and Career Ops Workspace.

Physical modules:

- `api/` owns HTTP routing and response mapping.
- `services/` owns application use-case orchestration.
- `contracts/` owns Zod DTO schemas.
- `career-ops-engine/` owns typed operations against Career Ops Tool, such as `runScan()`.
- `workspace/` owns safe file reads/writes and workspace validation.
- `runs/` owns ScanRun lifecycle.
- `parsers/` owns Career Ops output parsing and warnings.
- `outputs/` owns report/artifact indexing and serving by opaque ID.
- `storage/` owns wrapper metadata such as run summaries.
- `errors/` owns stable API error codes and mapping.
- `security/` owns local pairing token checks, path guards, and redaction.

The backend must never expose a generic command endpoint or a user-configurable shell command.

**Android Component Boundaries:**

Career Ops is a bounded Android feature package under `<existing-package>/careerops/`.

- Compose screens render `UiState` and send `Intent`.
- ViewModels coordinate use cases and emit `Effect`.
- Use cases call `CareerOpsRepository`.
- Repository coordinates Retrofit, settings storage, and Room.
- Mappers prevent API DTOs and Room entities from leaking into domain models.
- Room is projection cache only.

**Service Boundaries:**

The Wrapper Backend is one modular service. It should not be split into microservices for MVP.

Career Ops remains an external workspace/engine dependency. The wrapper integrates through safe files and typed engine operations.

MarkItDown is deferred documentation only in the core structure. It should become source code only when a later story promotes CV conversion from deferred/stretch to implementation scope.

**Data Boundaries:**

Canonical data:

- Career Ops Workspace files.

Projection data:

- Android Room entities.

Transient data:

- Wrapper run state.
- Parser warnings.
- Temp upload files for optional conversion.

Sensitive data:

- CV Markdown.
- Profile config.
- Portal/search config.
- Bearer token.
- Local workspace location/path.

Sensitive data must not cross into logs/screenshots/errors except in redacted form.

### Android Environment Configuration

Android uses two product flavors:

- `dev`
- `prod`

`dev` flavor:

- Application ID suffix: `.dev`.
- App name: `[DEV] Career Ops`.
- Default wrapper base URL: `http://10.0.2.2:3000` for Android emulator.
- Token may be optional for localhost/emulator development.
- HTTP cleartext is allowed only for local/dev targets through network security config.

`prod` flavor:

- No application ID suffix.
- App name: `Career Ops`.
- Local MVP wrapper base URL is supplied by BuildConfig or local build configuration, not by user-entered setup UI.
- Optional Local Pairing Token is build/session configuration for trusted local/LAN use only; it is not production authentication.

Android connection configuration remains minimal:

```kotlin
data class WrapperConnectionSettings(
    val baseUrl: String,
    val pairingToken: String?
)
```

Do not add user-editable endpoint fields, saved endpoint lists, settings persistence, or connection-profile registries for MVP.

CORS is not an MVP concern because the Android app is a native client using Retrofit/OkHttp, not a browser web app.

### Wrapper Runtime Configuration

Wrapper workspace selection is not Android configuration.

The wrapper should support either:

```bash
cd /path/to/career-ops
career-ops-wrapper
```

or:

```bash
career-ops-wrapper --workspace /path/to/career-ops --port 3000
```

The term "Career Ops Workspace Location" means the local folder on the machine running the wrapper that contains Career Ops files/scripts. Android never sees or stores this path.

Wrapper runtime config should prefer:

1. CLI flags.
2. `.env` fallback for local convenience.
3. safe defaults.

Useful runtime settings:

- `workspace`: required unless current directory validates as a Career Ops Workspace.
- `host`: defaults to local-safe behavior.
- `port`: defaults to `3000`.
- `token`: required when exposing LAN mode.

No free-form `CAREER_OPS_SCAN_COMMAND` should be public configuration. `POST /api/v1/scan-runs` maps internally to an allowlisted `runScan()` operation in `career-ops-engine/`.

### Requirements to Structure Mapping

**Wrapper Connection and Workspace Health (FR-1 to FR-3):**

- Android: `careerops/presentation/setup/`
- Android settings: `CareerOpsSettingsDataSource.kt`, `WrapperConnectionSettings.kt`
- Android API: `CareerOpsApiService.kt`, `CareerOpsAuthInterceptor.kt`
- Backend routes: `health-routes.ts`
- Backend config: `config/cli-args.ts`, `config/env.ts`, `config/runtime-config.ts`
- Backend workspace: `workspace/workspace-health.ts`

**CV and Profile Management (FR-4 to FR-7):**

- Android screens: `careerops/presentation/cvprofile/`
- Android use cases: `GetCvUseCase`, `SaveCvUseCase`, `GetProfileConfigUseCase`, `SaveProfileConfigUseCase`
- Backend routes: `cv-routes.ts`, `profile-routes.ts`
- Backend services: `cv-service.ts`, `profile-service.ts`
- Backend contracts: `cv-contract.ts`, `profile-contract.ts`
- Backend workspace adapters: `cv-file-adapter.ts`, `profile-file-adapter.ts`

**Portal Config and Search Criteria (FR-8 to FR-10):**

- Android screens: `careerops/presentation/portals/`
- Android use cases: `GetPortalConfigUseCase`, `SavePortalConfigUseCase`
- Backend routes: `portal-routes.ts`
- Backend service: `portal-service.ts`
- Backend contract: `portal-contract.ts`
- Backend workspace adapter: `portal-file-adapter.ts`

**Real Scan Execution (FR-11 to FR-13):**

- Android screens: `careerops/presentation/scans/`
- Android use cases: `StartScanRunUseCase`, `PollScanRunUseCase`
- Backend routes: `scan-run-routes.ts`
- Backend service: `scan-run-service.ts`
- Backend engine adapter: `career-ops-engine/`
- Backend run lifecycle: `runs/`
- Backend metadata persistence: `storage/`

**Offer Review (FR-14 to FR-16):**

- Android screens: `careerops/presentation/offers/`
- Android Room: `CareerOfferEntity`, `CareerOfferDao`
- Backend routes: `offer-routes.ts`
- Backend service: `offer-service.ts`
- Backend parsers: `pipeline-parser.ts`, `tracker-parser.ts`, `offer-projector.ts`

**Reports and Artifacts (FR-17 to FR-18):**

- Android screens: `careerops/presentation/reports/`
- Android Room: `ReportEntity`, `ReportDao`, `ArtifactEntity`, `ArtifactDao`
- Backend routes: `report-routes.ts`, `artifact-routes.ts`
- Backend service: `report-service.ts`
- Backend outputs: `outputs/`

**Neo-Brutalist Android Experience (FR-19 to FR-20):**

- Existing component base: `presentation/component/NeoBrutalist.kt`
- Career Ops screens: `careerops/presentation/...`
- Theme: `ui/theme/`

### Integration Points

**Internal Communication:**

Android:

`Compose Screen -> ViewModel -> UseCase -> Repository -> Retrofit/Settings/Room`

Backend:

`Fastify Route -> Zod Validation -> Service -> Career Ops Engine/Workspace/Parser/Output Adapter -> Contract DTO`

**External Integrations:**

- Career Ops Workspace files.
- Career Ops scanner/tool via `career-ops-engine/`.
- Android external intents for job URLs and artifacts.
- Optional future MarkItDown Python process for CV conversion.
- Optional future Gemini CLI/API evaluation adapter.

**Data Flow:**

1. Android saves CV/Profile/Portal DTOs.
2. Wrapper validates DTOs.
3. Workspace adapter safely writes Career Ops files.
4. Android starts a ScanRun.
5. Wrapper service asks `career-ops-engine` to run the allowlisted scan operation.
6. Career Ops Tool reads workspace config and writes output files.
7. Parser/projector reads Career Ops output files.
8. Wrapper returns Offer/ScanRun DTOs.
9. Android repository stores Room projections with `syncedAt`, `sourceRevision`, and `isStale` fields on projection entities.
10. Compose screens render cached/fresh state.

### File Organization Patterns

**Configuration Files:**

- Android Gradle config owns `dev` and `prod` product flavors.
- Android network security config allows dev/local cleartext only.
- Wrapper `.env.example` documents local fallback config.
- Wrapper `.env` is local-only and not committed.
- Career Ops Workspace Location belongs only to wrapper runtime config.

**Source Organization:**

- Android Career Ops source lives under `app/src/main/java/<existing-package>/careerops`.
- Wrapper source lives under `career-ops-wrapper/src`.
- Backend contract examples live under `career-ops-wrapper/contracts/examples`.
- Shared human-readable API docs live under `docs/career-ops-mobile/api-contract.md`.

**Test Organization:**

- Backend fixture tests use `career-ops-wrapper/fixtures/workspaces`.
- Backend run state machine tests live in `career-ops-wrapper/test/runs`.
- Android contract/repository/state/ViewModel tests live under `app/src/test/java/<existing-package>/careerops`.
- Android instrumentation/screenshot tests remain under `app/src/androidTest`.

**Asset Organization:**

- Android visual assets remain under `app/src/main/res`.
- Career Ops reports/artifacts are never copied into Android assets.
- Wrapper serves outputs by opaque ID from the configured workspace.

### Development Workflow Integration

**Development Server Structure:**

- Start Wrapper Backend from `career-ops-wrapper` or from the Career Ops Workspace using `--workspace`.
- `dev` Android flavor defaults to emulator base URL `http://10.0.2.2:3000`.
- `prod` Android flavor uses configured BuildConfig/local build values for local MVP access; no setup-screen URL entry is required.
- Trusted local/LAN access may use `X-Career-Ops-Token: <token>`, but production/public access is deferred to a separate hardening epic.

**Build Process Structure:**

- Android builds with Gradle using `dev` and `prod` flavors.
- Wrapper builds/tests with npm scripts.
- Wrapper should provide stable scripts: `npm run dev`, `npm run build`, and `npm test`.
- Backend package lock pins Node dependencies.
- MarkItDown adapter packaging is deferred until its story.

**Deployment Structure:**

- MVP deployment is local/private.
- Wrapper can later be Dockerized if needed.
- Remote private deployment requires revisiting security, HTTPS, token rotation, and data storage assumptions.

## API Contract Schemas

### Contract Rules

- API base path is `/api/v1`.
- JSON field names use `camelCase`.
- IDs are opaque strings and must not encode local file paths.
- Dates use ISO-8601 UTC strings.
- Optional fields may be omitted or set to `null`.
- Required fields must be present and non-null.
- Unknown enum-like values from Career Ops parsing should map to `unknown`.
- Backend Zod schemas are the source of truth.
- Android Moshi DTOs must parse checked-in contract examples.
- Local filesystem paths must not appear in public DTOs, errors, logs, or artifact URLs.

### Shared Types

```ts
type IsoDateTime = string; // ISO-8601 UTC
type OpaqueId = string;
type CurrencyCode = string; // /^[A-Z]{3}$/
type HttpUrl = string; // http or https URL
type SourceRevision = string;
```

### Collection Response

```json
{
  "items": [],
  "syncedAt": "2026-06-15T10:30:00.000Z",
  "sourceRevision": "scan_20260615_103000"
}
```

Validation:

- `items` is required array.
- `syncedAt` is required ISO-8601 UTC string.
- `sourceRevision` is optional opaque string.

### ErrorDto

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Profile config is invalid.",
    "details": {
      "field": "targetRoles"
    }
  }
}
```

Validation:

- `error.code` required enum:
  - `VALIDATION_ERROR`
  - `UNAUTHORIZED`
  - `WORKSPACE_UNHEALTHY`
  - `NOT_FOUND`
  - `SCAN_ALREADY_RUNNING`
  - `COMMAND_FAILED`
  - `PARSER_FAILED`
  - `PATH_OUTSIDE_WORKSPACE`
  - `PAYLOAD_TOO_LARGE`
  - `UNEXPECTED_ERROR`
- `error.message` required non-empty string.
- `error.details` optional object.
- `details` must not contain CV content, token values, or local absolute paths.

### HealthDto

```json
{
  "status": "ready",
  "workspace": {
    "status": "ready",
    "detected": true,
    "careerOpsVersion": "1.10.0",
    "missingRequirements": []
  },
  "capabilities": {
    "cv": true,
    "profile": true,
    "portals": true,
    "scan": true,
    "reports": true,
    "artifacts": true,
    "cvConversion": false,
    "geminiEvaluation": false
  },
  "serverTime": "2026-06-15T10:30:00.000Z"
}
```

Validation:

- `status` enum: `ready`, `degraded`, `notReady`.
- `workspace.status` enum: `ready`, `missing`, `invalid`, `unknown`.
- `workspace.detected` required boolean.
- `workspace.careerOpsVersion` optional string or null.
- `workspace.missingRequirements` required string array.
- Capability flags are required booleans.
- `serverTime` required ISO-8601 UTC string.

### CvDto

```json
{
  "markdown": "# Hy\n\n...",
  "sizeBytes": 12345,
  "updatedAt": "2026-06-15T10:30:00.000Z",
  "sourceRevision": "cv_sha256_abcd"
}
```

Validation:

- `markdown` required on `GET /cv` and `PUT /cv` response; non-empty string.
- `markdown` max UTF-8 size: 512 KB.
- `sizeBytes` required non-negative integer.
- `updatedAt` optional ISO-8601 UTC string or null.
- `sourceRevision` optional opaque string.
- `PUT /cv` rejects empty Markdown and oversized payloads.

### ProfileDto

```json
{
  "targetRoles": ["Android Developer", "Mobile Engineer"],
  "seniorityLevel": "mid",
  "preferredLocations": ["Ho Chi Minh City", "Remote"],
  "remotePreference": "hybrid",
  "salaryMin": 1500,
  "salaryMax": 2500,
  "salaryCurrency": "USD",
  "workAuthorizationNote": "Open to relocation.",
  "mustHaveSkills": ["Kotlin", "Jetpack Compose"],
  "niceToHaveSkills": ["Node.js", "Fastify"],
  "excludedKeywords": ["onsite only"],
  "positioningSummary": "Mobile engineer focused on real product integration.",
  "sourceRevision": "profile_sha256_abcd",
  "updatedAt": "2026-06-15T10:30:00.000Z"
}
```

Validation:

- `targetRoles` required non-empty string array.
- `seniorityLevel` required non-empty string.
- `preferredLocations` required non-empty string array.
- `remotePreference` required enum: `remote`, `hybrid`, `onsite`, `flexible`, `unknown`.
- `salaryMin`, `salaryMax` optional non-negative integers.
- If both salary values exist, `salaryMax >= salaryMin`.
- `salaryCurrency` required when either salary bound exists; must match `/^[A-Z]{3}$/`.
- Optional string arrays default to empty arrays in normalized responses.
- `positioningSummary` optional string, recommended max 2000 chars.
- `sourceRevision`, `updatedAt` optional.

### PortalDto

```json
{
  "titlePositiveKeywords": ["Android", "Kotlin"],
  "titleNegativeKeywords": ["Senior Manager"],
  "locationAllowList": ["Remote", "Ho Chi Minh"],
  "locationBlockList": ["onsite only"],
  "salaryMin": 1500,
  "salaryMax": 3000,
  "salaryCurrency": "USD",
  "trackedCompanies": [
    {
      "id": "company_linear",
      "name": "Linear",
      "careersUrl": "https://linear.app/careers",
      "provider": "generic",
      "enabled": true
    }
  ],
  "searchQueries": [
    {
      "id": "query_android_remote",
      "label": "Android Remote",
      "query": "Android Kotlin Remote",
      "enabled": true
    }
  ],
  "sourceRevision": "portals_sha256_abcd",
  "updatedAt": "2026-06-15T10:30:00.000Z"
}
```

Validation:

- Overall request payload max: 128 KB.
- Keyword/location arrays optional; normalized responses return arrays.
- `salaryMin`, `salaryMax` optional non-negative integers.
- If both salary values exist, `salaryMax >= salaryMin`.
- `salaryCurrency` required when either salary bound exists.
- `trackedCompanies` required array, may be empty.
- Each tracked company requires `name`, `careersUrl`, `enabled`.
- `careersUrl` must be HTTP/HTTPS URL.
- `provider` optional string or null.
- `searchQueries` required array, may be empty.
- Each search query requires `label`, `query`, `enabled`.
- Nested `id` fields are optional opaque IDs generated by backend if absent.
- `sourceRevision`, `updatedAt` optional.

### OfferDto

```json
{
  "id": "offer_linear_android_engineer",
  "company": "Linear",
  "title": "Android Engineer",
  "url": "https://linear.app/careers/android-engineer",
  "location": "Remote",
  "source": "pipeline",
  "status": "new",
  "firstSeenAt": "2026-06-15T10:30:00.000Z",
  "lastSeenAt": "2026-06-15T10:30:00.000Z",
  "scanRunId": "scan_20260615_103000",
  "salaryMin": 1500,
  "salaryMax": 2500,
  "salaryCurrency": "USD",
  "workMode": "remote",
  "score": 82,
  "reportId": "report_linear_android_engineer",
  "artifactIds": ["artifact_resume_linear_pdf"],
  "rawSource": "pipeline",
  "notes": "Parsed from Career Ops pipeline.",
  "warnings": []
}
```

Validation:

- `id`, `company`, `title`, `source`, `status` required.
- `status` enum: `new`, `tracked`, `applied`, `rejected`, `archived`, `unknown`.
- `url` optional HTTP/HTTPS URL or null.
- `location` optional string or null.
- `firstSeenAt`, `lastSeenAt` optional ISO-8601 UTC strings or null.
- `scanRunId`, `reportId` optional opaque IDs or null.
- `salaryMin`, `salaryMax` optional non-negative integers.
- If both salary values exist, `salaryMax >= salaryMin`.
- `salaryCurrency` required when either salary bound exists.
- `workMode` enum: `remote`, `hybrid`, `onsite`, `flexible`, `unknown`.
- `score` optional integer 0-100 or null.
- `artifactIds` optional opaque ID array, normalized to empty array.
- `rawSource` optional sanitized string; must not contain local absolute paths.
- `warnings` optional string array, normalized to empty array.

### ScanRunDto

```json
{
  "id": "scan_20260615_103000",
  "status": "running",
  "stage": "executing",
  "startedAt": "2026-06-15T10:30:00.000Z",
  "finishedAt": null,
  "exitCode": null,
  "active": true,
  "summary": {
    "offersFound": 0,
    "offersProjected": 0,
    "warnings": []
  },
  "failure": null,
  "sourceRevision": "scan_20260615_103000"
}
```

Validation:

- `id` required opaque string.
- `status` enum: `pending`, `running`, `succeeded`, `failed`, `cancelled`, `unknown`.
- `stage` enum: `queued`, `executing`, `parsing`, `projecting`, `completed`, `failed`.
- `startedAt` optional ISO-8601 UTC string or null.
- `finishedAt` optional ISO-8601 UTC string or null.
- `exitCode` optional integer or null.
- `active` required boolean.
- `summary.offersFound`, `summary.offersProjected` required non-negative integers.
- `summary.warnings` required string array.
- `failure` optional object:
  - `code` non-empty string
  - `message` non-empty string
- `failure` and `summary.warnings` must be sanitized.
- Concurrent start returns `409` with `SCAN_ALREADY_RUNNING` and active `scanRunId`.

### ReportDto

List response item:

```json
{
  "id": "report_linear_android_engineer",
  "offerId": "offer_linear_android_engineer",
  "title": "Linear Android Engineer Evaluation",
  "kind": "evaluation",
  "createdAt": "2026-06-15T10:30:00.000Z",
  "updatedAt": "2026-06-15T10:30:00.000Z",
  "sourceRevision": "reports_sha256_abcd"
}
```

Detail response:

```json
{
  "id": "report_linear_android_engineer",
  "offerId": "offer_linear_android_engineer",
  "title": "Linear Android Engineer Evaluation",
  "kind": "evaluation",
  "markdown": "# Evaluation\n\n...",
  "createdAt": "2026-06-15T10:30:00.000Z",
  "updatedAt": "2026-06-15T10:30:00.000Z",
  "sourceRevision": "reports_sha256_abcd"
}
```

Validation:

- `id`, `title`, `kind` required.
- `offerId` optional opaque ID or null.
- `kind` enum: `evaluation`, `summary`, `notes`, `unknown`.
- `markdown` required only on detail endpoint.
- `markdown` must not include injected local absolute paths from wrapper.
- `createdAt`, `updatedAt`, `sourceRevision` optional.

### ArtifactDto

```json
{
  "id": "artifact_resume_linear_pdf",
  "offerId": "offer_linear_android_engineer",
  "reportId": "report_linear_android_engineer",
  "filename": "resume-linear.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 120000,
  "downloadUrl": "/api/v1/artifacts/artifact_resume_linear_pdf",
  "createdAt": "2026-06-15T10:30:00.000Z",
  "sourceRevision": "artifacts_sha256_abcd"
}
```

Validation:

- `id`, `filename`, `contentType`, `downloadUrl` required.
- `offerId`, `reportId` optional opaque IDs or null.
- `sizeBytes` optional non-negative integer or null.
- `downloadUrl` must be API-relative or same-origin URL; never a local file path.
- Artifact serving resolves opaque ID server-side and enforces workspace boundary.
- `createdAt`, `sourceRevision` optional.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**

All major decisions work together coherently:

- Android remains Kotlin/Jetpack Compose and keeps the existing app foundation.
- Wrapper Backend is Node.js/TypeScript with Fastify and Zod.
- Career Ops Workspace remains canonical source of truth.
- Android Room is a projection cache only.
- REST `/api/v1` contract gives Android a stable boundary without exposing Career Ops internals.
- Career Ops Engine Adapter keeps tool/script invocation separate from mobile-facing API concerns.
- MarkItDown and Gemini integrations are optional/future adapters, so MVP Real First scan/offers flow is not blocked by Python packaging or API keys.

**Pattern Consistency:**

Implementation patterns support the decisions:

- Naming conventions align across backend Zod DTOs and Android Moshi DTOs.
- Error envelope is stable and shared across backend and Android UI mapping.
- ScanRun state and polling rules are consistent with mobile responsiveness requirements.
- Bearer token usage is consistent with LAN/private API access and no account-auth MVP scope.
- Dev/prod Android flavors reduce connection-profile over-engineering while keeping local and LAN workflows supported.

**Structure Alignment:**

The project structure supports the architecture:

- Android Career Ops code is bounded under `<existing-package>/careerops`.
- Backend routes, services, contracts, workspace adapters, engine adapter, parsers, outputs, runs, errors, security, and storage are separated.
- Contract examples and fixture workspaces have explicit locations.
- Real First evidence has a documented home under `docs/career-ops-mobile/evidence`.

### Requirements Coverage Validation ✅

**Feature Coverage:**

The architecture covers the PRD feature groups:

- Wrapper connection and workspace health.
- CV and profile management.
- Portal config and search criteria.
- Real scan execution.
- Offer review.
- Reports and artifacts.
- Neo-brutalist Android experience.

**Functional Requirements Coverage:**

FR-1 through FR-20 are architecturally supported through:

- Android setup/settings/API modules.
- Wrapper `/api/v1` endpoints.
- Safe workspace adapters.
- Career Ops Engine Adapter and ScanRun manager.
- Parser/projector modules for offers.
- Outputs module for reports/artifacts.
- Android Room projection cache and MVI screens.

**Non-Functional Requirements Coverage:**

NFR-1 through NFR-9 are covered:

- Real Integration First: Real First evidence gate plus engine adapter/fixture strategy.
- File Safety: safe file adapter contract with backup, atomic write, read-after-write.
- Workspace Boundary: path guards and opaque IDs.
- Command Allowlist: typed `runScan()` operation, no generic command endpoint.
- Privacy: redaction rules and sensitive-data boundaries.
- Local-First Security: localhost/dev plus LAN local pairing token.
- Mobile Responsiveness: ScanRun resources and polling.
- Recoverability: persisted run metadata/log summary and failure DTOs.
- Portfolio Readability: docs, evidence folder, architecture trade-offs, and project structure.

### Implementation Readiness Validation ✅

**Decision Completeness:**

Critical decisions are documented with versions and rationale:

- Node.js 24 LTS.
- Fastify 5.x.
- Zod 4.x.
- TypeScript 6.x.
- Vitest 4.x.
- Android Kotlin/Compose/Room/Retrofit/Moshi/coroutines/MVI.

**Structure Completeness:**

The project structure is specific enough for downstream implementation stories. It defines:

- Android feature package boundaries.
- Backend module boundaries.
- Contract examples.
- Fixture workspaces.
- Test locations.
- Documentation/evidence locations.
- Runtime configuration boundaries.

**Pattern Completeness:**

Potential AI-agent conflict points are covered:

- Naming.
- File structure.
- API response format.
- Error handling.
- Loading/polling state.
- Security redaction.
- Fixture and contract test organization.
- Optional adapter boundaries.

### Gap Analysis Results

**Critical Gaps:** None remaining.

The previous critical gap, exact DTO schema definition, has been addressed by the `API Contract Schemas` section.

**Important Gaps:** None blocking.

Implementation must convert the documented contract schemas into Zod schemas, Android Moshi DTOs, and contract examples. This is an implementation task, not an architecture blocker.

**Nice-to-Have Gaps:**

- Generate OpenAPI from Zod after the wrapper contract stabilizes.
- Add Docker packaging if Career Ops/MarkItDown/Playwright setup becomes fragile.
- Add WebSocket updates only if polling becomes insufficient.
- Promote MarkItDown CV conversion after core scan/offers flow is proven.

### Validation Issues Addressed

- Replaced over-engineered mobile connection profiles with Android `dev` and `prod` product flavors plus simple `WrapperConnectionSettings`.
- Clarified Career Ops Workspace Location and removed hard-coded env-key framing from architecture.
- Removed public free-form scan command configuration; scan is a typed allowlisted engine operation.
- Split backend structure into mobile-facing wrapper modules and Career Ops Engine Adapter.
- Added service layer, error module, storage module, outputs module, contract examples, fixture structure, and Real First evidence folder.
- Added exact API Contract Schemas for Profile, Portal, Offer, ScanRun, Report, Artifact, CV, Health, Error, and collection responses.

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**

- Clear Real First MVP boundary.
- Strong separation between Android UI, wrapper API, Career Ops Engine Adapter, and Career Ops Workspace files.
- Exact DTO schemas now included.
- Security/privacy risks are addressed for local and LAN use.
- Test fixtures, contract examples, and evidence artifacts are explicitly located.
- Optional MarkItDown/Gemini work is valuable but no longer blocks MVP.

**Areas for Future Enhancement:**

- OpenAPI generation from Zod.
- Docker packaging for reproducible local setup.
- MarkItDown CV conversion implementation.
- Gemini evaluation adapter.
- Remote private deployment with HTTPS and token rotation.

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented.
- Use implementation patterns consistently across Android and backend components.
- Respect project structure and boundaries.
- Do not add generic command execution endpoints.
- Do not make Android source-of-truth for Career Ops data.
- Convert API Contract Schemas into backend Zod schemas and Android DTO tests early.
- Use fixture workspaces and contract examples as implementation guardrails.

**First Implementation Priority:**

Scaffold `career-ops-wrapper` with Fastify, Zod, TypeScript, Vitest, runtime config, `/api/v1/health`, workspace validation, contract examples, and the first fixture-backed tests. Android work should begin after the wrapper health and contract foundation are stable.
