---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - /Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/prd.md
  - /Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md
---

# task-arena - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for task-arena, decomposing the requirements from the PRD and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: The Android app must let the user enter, save, update, validate, and retry the Wrapper Backend endpoint used for API calls.

FR2: The Android app must request and display Wrapper Backend health, including service availability and Career Ops Workspace readiness, and block scan actions when health is not ready.

FR3: The Android app must show concise setup guidance when the Wrapper Backend or Career Ops Workspace is not ready, without claiming to install Career Ops automatically.

FR4: The Android app must load the current CV Markdown from the Wrapper Backend, display content or status when present, show a not-ready state when missing, and preserve last-known cached state on backend errors.

FR5: The user must be able to upload or edit CV Markdown and save it through the Wrapper Backend; the backend must validate size/content, write only inside the Career Ops Workspace, back up or preserve the previous file, and read back the saved content.

FR6: The Android app must load normalized Profile Config fields from the Wrapper Backend, display the MVP Profile Fields, preserve unsupported upstream fields on reads, and show actionable not-ready state when missing.

FR7: The user must be able to edit and save MVP Profile Config fields through the Wrapper Backend; save must validate required fields, preserve unknown fields where possible, keep previous known-good config on failure, and support read-after-write.

FR8: The Android app must load normalized Portal Config from the Wrapper Backend, display MVP Portal Fields, report invalid upstream YAML as backend validation error, and avoid silently repairing invalid config.

FR9: The user must be able to edit and save MVP Portal Config fields through the Wrapper Backend; save must validate structure, preserve unknown fields where possible, back up previous config, support read-after-write, and reject payloads over 128 KB.

FR10: The app must validate scan readiness from current CV, Profile Config, Portal Config, and workspace health, with distinct readiness messages and disabled scan action when readiness fails.

FR11: The user must be able to start a real Career Ops Scan Run when readiness checks pass; the backend must create a stable run ID, execute the real scanner, return initial status without waiting for completion, and reject concurrent scans.

FR12: The Android app must poll and display Scan Run status, including pending/running/succeeded/failed states, timestamps, failure details, and state survival across screen rotation or ViewModel recreation.

FR13: The Wrapper Backend must preserve Scan Run auditability with command type, start/end time, exit status, sanitized logs or summary, no sensitive CV/profile content in logs, and no corruption of Career Ops user-layer files on failure.

FR14: The Android app must display Offers returned by the Wrapper Backend based on parsed Career Ops pipeline/tracker files, including all minimum Offer DTO fields, optional fields when present, and distinct empty states.

FR15: The user must be able to open an Offer detail view showing all minimum and optional fields returned by the backend, gracefully handling missing optional fields and opening external job URLs through Android external intents.

FR16: The Android app must store a projection cache of latest Offers for responsive UI, show cached Offers when the wrapper is temporarily unreachable, distinguish cached/stale state from fresh state, and treat wrapper data as source of truth after refresh.

FR17: The Android app must list available Reports and Artifacts returned by the Wrapper Backend, link them to Offers when known, and distinguish not-generated state from backend error.

FR18: The user must be able to open a Markdown Report in-app or download/open an Artifact; artifact downloads must be served only from inside the Career Ops Workspace and missing files must return clear errors.

FR19: The Android app must preserve the current neo-brutalist visual language for Career Ops screens, including bold borders, hard shadows, existing accent colors, and consistent loading/empty/error states.

FR20: The Android app must provide navigable MVP surfaces for setup, CV/Profile, Portal Config, Scan Status, Offer List, Offer Detail, and Reports/Artifacts, enabling UJ-1 through UJ-4 without terminal-only actions except external job URLs.

### NonFunctional Requirements

NFR1: Real Integration First. MVP completion requires the Wrapper Backend to call real Career Ops scripts and read/write real Career Ops files for the core scan flow.

NFR2: File Safety. Any write to CV, Profile Config, or Portal Config must validate input and preserve or back up the previous known-good file.

NFR3: Workspace Boundary. Wrapper Backend must never read or serve files outside the configured Career Ops Workspace.

NFR4: Command Allowlist. Wrapper Backend must never expose arbitrary shell command execution.

NFR5: Privacy. Logs and run records must not expose full CV/profile content or secrets.

NFR6: Local-First Security. Wrapper Backend binds to localhost by default; LAN/private access requires a Local Pairing Token.

NFR7: Mobile Responsiveness. Android App must not block UI while scans run; long-running work is represented by run status.

NFR8: Recoverability. Failed saves and failed scans must leave the system in a debuggable, recoverable state.

NFR9: Portfolio Readability. The repository should make architecture and trade-offs understandable to future reviewers through README/docs after implementation.

### Additional Requirements

- Use the existing Android Kotlin/Jetpack Compose app as the mobile foundation; do not replace it with a new Android starter.
- Add a new `career-ops-wrapper` Node.js/TypeScript backend using Fastify, Zod, `js-yaml`, `dotenv`, `tsx`, and Vitest.
- Use Node.js 24 LTS, Fastify 5.x, Zod 4.x, TypeScript 6.x, and Vitest 4.x as the baseline stack.
- API base path must be `/api/v1`.
- Backend Zod schemas are the source of truth for API contracts; Android Moshi DTOs must parse checked-in contract examples.
- Implement exact API Contract Schemas for Collection, Error, Health, CV, Profile, Portal, Offer, ScanRun, Report, and Artifact DTOs as defined in Architecture.
- Backend must expose typed endpoint families for health, CV, profile, portals, scan-runs, offers, reports, and artifacts.
- Backend must not expose `/run`, `/exec`, `/command`, or any generic command execution endpoint.
- Backend must split mobile-facing wrapper concerns from `career-ops-engine` adapter concerns.
- `career-ops-engine` must expose typed allowlisted operations such as `runScan()`, not user-configurable shell command strings.
- MVP `runScan()` must execute the local Career Ops script runner inside the configured Career Ops Workspace using `node scan.mjs` or equivalent `npm run scan`; this path is zero-token and does not require Gemini/OpenAI/Anthropic API keys.
- Career Ops Workspace Location is wrapper runtime configuration only; Android never sees or stores local workspace paths.
- Wrapper should support running inside a Career Ops Workspace or receiving `--workspace /path/to/career-ops`.
- Wrapper runtime config should prefer CLI flags, then `.env` fallback, then safe defaults.
- Android must use two product flavors: `dev` and `prod`.
- `dev` flavor should use application ID suffix `.dev`, app name `[DEV] Career Ops`, default wrapper URL `http://10.0.2.2:3000`, and dev/local cleartext network config.
- `prod` flavor should have no suffix, app name `Career Ops`, empty default wrapper URL, user-entered setup URL, and token required for non-localhost/LAN endpoints.
- Android must store only `WrapperConnectionSettings(baseUrl, pairingToken)` for wrapper connection; do not build a saved endpoint list or connection-profile registry for MVP.
- Android Career Ops code must live under a bounded feature package: `app/src/main/java/<existing-package>/careerops`.
- Android Career Ops feature must be layered into `data`, `domain`, and `presentation`.
- Android repository must coordinate Retrofit, settings storage, and Room.
- Android mappers must prevent API DTOs and Room entities from leaking into domain models.
- Android Room projection entities must include freshness metadata such as `syncedAt`, `sourceRevision`, and `isStale`; no separate `SourceSyncMetadataEntity` is required for MVP.
- Backend routes must remain HTTP mapping only; application orchestration belongs in `services/`.
- Backend modules must include `api`, `services`, `contracts`, `career-ops-engine`, `workspace`, `runs`, `parsers`, `outputs`, `storage`, `errors`, and `security`.
- Use `outputs/` for read-only reports and artifacts served by opaque ID.
- Store backend contract examples under `career-ops-wrapper/contracts/examples`.
- Store fixture workspaces under `career-ops-wrapper/fixtures/workspaces`, including golden input/output/expected and failure cases.
- Store Real First evidence under `docs/career-ops-mobile/evidence`.
- Wrapper must provide stable scripts: `npm run dev`, `npm run build`, and `npm test`.
- Use `X-Career-Ops-Token: <token>` for LAN/private API access.
- CORS is not an MVP concern because Android is a native Retrofit/OkHttp client.
- MarkItDown CV conversion is deferred/stretch only; document it under `docs/career-ops-mobile/deferred/markitdown-adapter.md` and do not create core source code for it until a later story promotes it.
- Native AI CLI slash-command workflows (Antigravity/Claude/Gemini/Codex/OpenCode/Qwen) are optional/future and require a separate headless/non-interactive spike before backend automation.
- Standalone API-key evaluator scripts such as `gemini-eval.mjs` are optional/future provider mode because of cost/token concerns; MVP core scan/offers flow must not require `GEMINI_API_KEY` or any provider API key.
- Real First acceptance requires one end-to-end flow proving Android -> Wrapper API -> real Career Ops workspace read/write -> real scan command -> parsed offers/reports if present -> Android Room projection refresh.
- Backend tests must cover Zod schemas, file adapter integration, scan manager conflicts, parser fixtures, mutation safety, path traversal, invalid tokens, command injection strings, and log redaction.
- Android tests must cover contract deserialization, repository behavior, Room cache freshness, ViewModel MVI transitions, scan polling, and stale/offline states.

### UX Design Requirements

UX-DR1: Career Ops screens must reuse the existing neo-brutalist visual language, including bold borders, hard shadows, saturated accents, compact card surfaces, expressive buttons, and existing theme colors.

UX-DR2: Setup, CV/Profile, Portal Config, Scan Status, Offer List, Offer Detail, and Reports/Artifacts screens must present loading, empty, error, and success states consistently with existing visual primitives.

UX-DR3: Setup UI must clearly distinguish wrapper unreachable, workspace invalid, missing required files, command unavailable, and script failure states.

UX-DR4: CV/Profile and Portal Config UI must show validation warnings without discarding the previous known-good state.

UX-DR5: Scan UI must represent long-running work through non-blocking status and polling rather than frozen UI.

UX-DR6: Offer list UI must distinguish no scan yet, scan completed with zero offers, stale cached offers, and fresh synced offers.

UX-DR7: Report/Artifact UI must distinguish not generated, missing file, and backend error.

UX-DR8: External job URLs must open through Android external intents; MVP must not embed a browser.

UX-DR9: Android navigation must allow UJ-1 through UJ-4 without requiring terminal-only actions inside the mobile workflow.

### FR Coverage Map

FR1: Epic 1 - Configure wrapper endpoint.
FR2: Epic 1 - Display wrapper and workspace health.
FR3: Epic 1 - Surface setup guidance.

FR4: Epic 2 - Read CV Markdown.
FR5: Epic 2 - Save CV Markdown safely.
FR6: Epic 2 - Read normalized Profile Config.
FR7: Epic 2 - Save Profile Config safely.

FR8: Epic 3 - Read Portal Config.
FR9: Epic 3 - Save Portal Config safely.
FR10: Epic 3 - Validate scan readiness.

FR11: Epic 4 - Start real Scan Run.
FR12: Epic 4 - Poll Scan Run status.
FR13: Epic 4 - Preserve Scan Run auditability.

FR14: Epic 5 - List Offers from Career Ops outputs.
FR15: Epic 5 - View Offer detail.
FR16: Epic 5 - Cache latest Offers.

FR17: Epic 6 - List Reports and Artifacts.
FR18: Epic 6 - Open Report or Artifact.
FR19: Epic 6 - Preserve current visual language.
FR20: Epic 6 - Provide MVP navigation surfaces.

## Epic List

### Epic 1: Connect to a Real Career Ops Workspace

Hy can open the Android app, connect to the Wrapper Backend, see truthful Career Ops Workspace health, and verify the API contract foundation before any job-search workflow starts.

**FRs covered:** FR1, FR2, FR3

**Key risk gates and dependencies:**

- Includes backend scaffold, `/api/v1/health`, runtime config, contract examples, Zod schema tests, Android `dev`/`prod` flavor config, and a minimal Android setup/health screen.
- Includes Android DTO deserialization smoke tests against checked-in contract examples.
- Owns baseline token/path/log-redaction security tests.
- Starts fixture workspace structure and Real First evidence documentation.
- Must remain user-value framed: the user can connect and understand readiness, not merely "backend setup."

#### Story 1.1: Scaffold Wrapper Backend API Foundation

As a personal mobile app user,
I want a local Wrapper Backend with a stable API foundation,
So that the Android app can communicate with Career Ops through a predictable `/api/v1` contract.

**Acceptance Criteria:**

**Given** the repository is opened for development
**When** the developer installs and runs the Wrapper Backend
**Then** a new `career-ops-wrapper` Node.js/TypeScript project exists with Fastify, Zod, TypeScript, Vitest, `tsx`, `dotenv`, and `js-yaml` configured
**And** the backend provides stable scripts for `npm run dev`, `npm run build`, and `npm test`.

**Given** the Wrapper Backend is running
**When** the Android app or developer calls an API endpoint
**Then** all MVP API routes are mounted under `/api/v1`
**And** there are no generic command endpoints such as `/run`, `/exec`, `/command`, or equivalent.

**Given** the backend source is inspected
**When** module boundaries are reviewed
**Then** mobile-facing API routes, application services, Zod contracts, workspace access, engine adapter, run management, parsers, outputs, storage, errors, and security concerns are separated into named modules
**And** routes contain HTTP mapping only while orchestration lives in services.

**Given** a future scan operation needs to call Career Ops
**When** backend code references scanner behavior
**Then** it depends on a typed `career-ops-engine` adapter interface
**And** the adapter exposes allowlisted operations such as `runScan()` instead of accepting user-provided shell commands.

#### Story 1.2: Validate Wrapper Runtime Configuration and Workspace Boundary

As a personal mobile app user,
I want the Wrapper Backend to know which Career Ops Workspace it is allowed to use,
So that mobile actions read and write only the intended local workspace.

**Acceptance Criteria:**

**Given** the Wrapper Backend starts
**When** runtime configuration is loaded
**Then** configuration is resolved in this order: CLI flags, `.env` fallback, safe defaults
**And** the workspace location can be provided by running inside a Career Ops Workspace or by passing `--workspace /path/to/career-ops`.

**Given** the Wrapper Backend has resolved a workspace location
**When** workspace validation runs
**Then** the backend reports whether the workspace path exists, is readable, is writable where needed, and appears to contain the expected Career Ops structure
**And** the Android app never receives or stores the absolute local workspace path.

**Given** an API request attempts to access a file
**When** the requested path contains traversal patterns, symlinks, absolute paths, or output IDs that resolve outside the configured workspace
**Then** the backend rejects the request with a typed error
**And** no file outside the Career Ops Workspace is read, written, downloaded, or served.

**Given** the Wrapper Backend is reachable from LAN or private network mode
**When** a request is made to protected API routes
**Then** the backend requires `X-Career-Ops-Token: <token>` according to runtime security settings
**And** invalid or missing tokens return a typed unauthorized error without leaking workspace details.

**Given** backend logs are written during configuration or validation failures
**When** logs are inspected
**Then** they do not include full CV content, profile content, secrets, local pairing tokens, or unnecessary absolute workspace file contents.

#### Story 1.3: Expose Health and Workspace Readiness API

As a personal mobile app user,
I want the Android app to receive truthful backend and workspace readiness status,
So that I know whether Career Ops is ready before trying to scan jobs.

**Acceptance Criteria:**

**Given** the Wrapper Backend is running
**When** `GET /api/v1/health` is called
**Then** the response includes backend service availability, API version, workspace readiness, Career Ops engine readiness, and a timestamp
**And** the response follows the checked-in Health DTO schema.

**Given** the configured Career Ops Workspace is valid
**When** `GET /api/v1/health` is called
**Then** the response marks workspace readiness as ready
**And** includes concise readiness messages suitable for Android display.

**Given** the wrapper is running but the Career Ops Workspace is missing, invalid, unreadable, or missing required files
**When** `GET /api/v1/health` is called
**Then** the response marks workspace readiness as not ready
**And** identifies the failure category without exposing sensitive local file details.

**Given** the Career Ops scan operation is unavailable
**When** `GET /api/v1/health` is called
**Then** the response marks scanner readiness as not ready
**And** scan start actions can be blocked by Android based on the health response.

**Given** the configured Career Ops Workspace is valid
**When** `GET /api/v1/health` is called
**Then** the response includes script readiness for the zero-token local scan path, including whether `doctor.mjs`, `scan.mjs`, and `portals.yml` are present/readable enough for later scan stories
**And** it does not require or report provider API-key readiness for MVP scan capability.

**Given** the backend is unavailable or returns malformed data
**When** Android requests health
**Then** Android can classify the state as wrapper unreachable or invalid response
**And** the UI can show setup guidance without claiming to install Career Ops automatically.

#### Story 1.4: Configure Android Dev and Prod Wrapper Connection

As a personal mobile app user,
I want the Android app to have simple dev and prod connection behavior,
So that I can use the app on emulator or a personal device without managing complex connection profiles.

**Acceptance Criteria:**

**Given** the Android project is built
**When** product flavors are inspected
**Then** the app defines exactly two MVP flavors: `dev` and `prod`
**And** `dev` uses application ID suffix `.dev`, app name `[DEV] Career Ops`, and default wrapper URL `http://10.0.2.2:3000`.

**Given** the `prod` flavor is built
**When** connection defaults are inspected
**Then** `prod` has no application ID suffix, app name `Career Ops`, and no hardcoded default wrapper URL
**And** the user must enter the wrapper base URL before API calls can succeed.

**Given** the app runs in `dev` flavor
**When** it connects to the local Wrapper Backend from an Android emulator
**Then** it can use cleartext HTTP for the configured local development URL
**And** the network security configuration is limited to dev/local development needs.

**Given** the app runs against a LAN/private backend URL
**When** the user saves wrapper connection settings
**Then** the app stores only `WrapperConnectionSettings(baseUrl, pairingToken)`
**And** it does not create a saved endpoint list, workspace path field, or connection-profile registry for MVP.

**Given** an API request is sent from Android
**When** a local pairing token is configured
**Then** the Retrofit/OkHttp client attaches `X-Career-Ops-Token: <token>`
**And** if no token is configured, the client omits the header rather than sending an empty token.

**Given** Android connection settings are changed
**When** the user saves and retries connection
**Then** subsequent API calls use the latest base URL and token
**And** previous failed connection attempts do not permanently block retry.

#### Story 1.5: Show Android Setup and Health Screen

As a personal mobile app user,
I want a setup screen that shows connection and Career Ops readiness clearly,
So that I can fix local setup issues before using CV, config, or scan features.

**Acceptance Criteria:**

**Given** the user opens the Career Ops area for the first time
**When** no valid wrapper connection has been saved
**Then** the Android app shows a setup screen with wrapper base URL input, optional Local Pairing Token input, and a retry/check action
**And** the screen uses the existing neo-brutalist visual language.

**Given** the wrapper connection is saved
**When** the user taps retry/check health
**Then** Android calls `GET /api/v1/health`
**And** displays loading, success, not-ready, and error states consistently with existing visual primitives.

**Given** the wrapper cannot be reached
**When** the health request fails due to network or timeout
**Then** the setup screen displays wrapper unreachable guidance
**And** the user can edit the URL/token and retry without restarting the app.

**Given** the wrapper is reachable but workspace readiness fails
**When** the health response identifies missing workspace, invalid workspace, missing required files, command unavailable, or script failure
**Then** the setup screen displays the matching concise guidance
**And** it does not claim Android can install or repair Career Ops automatically.

**Given** the wrapper and workspace are ready
**When** health status is displayed
**Then** the setup screen clearly marks the connection as ready
**And** downstream scan actions can rely on this readiness state.

**Given** the screen is rotated or the ViewModel is recreated
**When** the setup screen returns
**Then** the latest connection input and health UI state survive without losing unsaved edits unnecessarily.

#### Story 1.6: Prove API Contract Compatibility with Tests and Examples

As a personal mobile app maintainer,
I want backend contract examples and Android parsing tests,
So that API changes do not silently break the mobile app.

**Acceptance Criteria:**

**Given** backend Zod schemas are defined for the MVP API contracts
**When** `npm test` runs in `career-ops-wrapper`
**Then** Health, Error, Collection, CV, Profile, Portal, Offer, ScanRun, Report, and Artifact schemas validate representative success and failure examples
**And** schema failures produce readable test output.

**Given** contract examples are checked in
**When** a developer inspects `career-ops-wrapper/contracts/examples`
**Then** each MVP DTO family has at least one valid JSON example
**And** error examples cover unauthorized, validation failure, workspace not ready, path boundary rejection, and scan conflict where applicable.

**Given** Android DTOs are implemented with Moshi
**When** Android contract deserialization tests run
**Then** the Android DTOs successfully parse checked-in backend contract examples
**And** required fields, optional fields, null handling, and unknown JSON fields behave according to the architecture contract.

**Given** backend schemas change
**When** contract examples are updated or tests are run
**Then** incompatible changes are caught by either backend schema tests or Android deserialization tests
**And** the developer must intentionally update both sides of the contract.

**Given** Real First evidence documentation exists
**When** Epic 1 is complete
**Then** `docs/career-ops-mobile/evidence` contains an initial evidence note describing backend startup, health response, workspace readiness behavior, and contract test status
**And** the evidence note does not claim that scan/offers are complete before later epics implement them.

### Epic 2: Prepare Career Inputs Safely

Hy can manage CV Markdown and Profile Config from Android while the wrapper safely reads/writes real Career Ops files without corrupting previous known-good data.

**FRs covered:** FR4, FR5, FR6, FR7

**Key risk gates and dependencies:**

- Reuses workspace/path boundary from Epic 1.
- Establishes safe file adapter semantics for CV/Profile writes: validation, backup, atomic replace, read-after-write, and previous valid file survival on failure.
- Adds CV/Profile fixture cases and mutation safety tests.
- Applies existing neo-brutalist components incrementally, not as deferred polish.

#### Story 2.1: Read CV Markdown from Career Ops Workspace

As a personal mobile app user,
I want the Android app to load my current CV Markdown from Career Ops,
So that I can review the resume content Career Ops will use before editing or scanning.

**Acceptance Criteria:**

**Given** the Wrapper Backend is connected to a valid Career Ops Workspace
**When** Android calls the CV read endpoint
**Then** the backend reads the configured CV Markdown file only from inside the Career Ops Workspace
**And** returns a CV DTO with content, metadata, source revision or timestamp, and readiness status.

**Given** the CV Markdown file exists and is readable
**When** the CV read endpoint is called
**Then** the response includes the Markdown content without altering it
**And** the response follows the checked-in CV DTO schema.

**Given** the CV Markdown file is missing
**When** the CV read endpoint is called
**Then** the backend returns a typed not-ready or missing-file state
**And** Android can display an actionable not-ready message instead of treating it as an unknown backend failure.

**Given** the CV path resolution is attempted
**When** the path would resolve outside the Career Ops Workspace
**Then** the backend rejects the read with a typed path-boundary error
**And** no external file content is returned.

**Given** the backend logs the CV read operation
**When** logs are inspected
**Then** logs include operational metadata only
**And** they do not include full CV content.

#### Story 2.2: Save CV Markdown with Validation and Backup

As a personal mobile app user,
I want to upload or edit my CV Markdown from Android safely,
So that Career Ops can use the updated CV without risking corruption of the previous version.

**Acceptance Criteria:**

**Given** Android submits updated CV Markdown
**When** the backend receives the save request
**Then** the backend validates that the payload is Markdown text, non-empty, within the configured MVP size limit, and free of unsupported file-upload formats
**And** invalid input returns a typed validation error without modifying the existing CV file.

**Given** a valid CV Markdown save request is received
**When** the backend writes the CV file
**Then** it writes only inside the configured Career Ops Workspace
**And** it creates a backup or preserves the previous known-good CV before replacing the active file.

**Given** the CV write operation succeeds
**When** the save endpoint returns
**Then** the backend performs read-after-write verification
**And** returns the saved CV DTO with updated metadata and source revision or timestamp.

**Given** the CV write operation fails midway
**When** the failure is handled
**Then** the previous known-good CV remains available
**And** the backend returns a typed recoverable error with no sensitive CV content in the message.

**Given** malicious input attempts path traversal, absolute path targeting, command-like strings, or unsupported file extension behavior
**When** the CV save endpoint validates the request
**Then** the backend rejects unsafe file access or unsupported upload behavior
**And** no arbitrary command execution or out-of-workspace write occurs.

**Given** CV mutation safety tests run
**When** valid, invalid, oversized, missing workspace, and simulated write-failure cases are executed against fixture workspaces
**Then** tests prove successful read-after-write and previous-file preservation on failure.

#### Story 2.3: Read and Normalize Profile Config

As a personal mobile app user,
I want the Android app to load my Career Ops Profile Config as editable MVP fields,
So that I can update job-search preferences without manually editing config files.

**Acceptance Criteria:**

**Given** the Wrapper Backend is connected to a valid Career Ops Workspace
**When** Android calls the Profile Config read endpoint
**Then** the backend reads the configured profile file only from inside the Career Ops Workspace
**And** returns a normalized Profile DTO containing the MVP Profile Fields defined by the architecture.

**Given** the upstream Profile Config contains fields outside the MVP editing surface
**When** the backend normalizes the config
**Then** unsupported or unknown upstream fields are preserved internally for future save operations where possible
**And** Android receives only the supported normalized fields plus metadata needed for freshness/readiness.

**Given** the Profile Config exists and is valid
**When** the Profile Config read endpoint is called
**Then** the response follows the checked-in Profile DTO schema
**And** required and optional MVP fields are represented consistently for Android rendering.

**Given** the Profile Config is missing
**When** the read endpoint is called
**Then** the backend returns an actionable not-ready state
**And** Android can display guidance without silently creating or repairing a config file.

**Given** the Profile Config contains invalid or unsupported structure
**When** the read endpoint validates it
**Then** the backend returns a typed validation error
**And** it does not silently rewrite, repair, or discard the existing upstream file.

**Given** the backend logs the Profile Config read operation
**When** logs are inspected
**Then** logs include operational status only
**And** they do not include full profile content or secrets.

#### Story 2.4: Save Profile Config Safely

As a personal mobile app user,
I want to edit and save my Career Ops Profile Config from Android,
So that Career Ops scans use my latest preferences without damaging unsupported config fields.

**Acceptance Criteria:**

**Given** Android submits edited MVP Profile Fields
**When** the backend receives the save request
**Then** the backend validates required fields, supported value formats, and payload size
**And** invalid input returns a typed validation error without modifying the existing Profile Config.

**Given** the existing Profile Config contains unsupported or unknown upstream fields
**When** the backend saves supported MVP field changes
**Then** it preserves unknown fields where possible
**And** only the supported edited fields are intentionally changed.

**Given** a valid Profile Config save request is received
**When** the backend writes the config file
**Then** it writes only inside the configured Career Ops Workspace
**And** it backs up or preserves the previous known-good config before replacing the active file.

**Given** the Profile Config write operation succeeds
**When** the save endpoint returns
**Then** the backend performs read-after-write verification
**And** returns the saved normalized Profile DTO with updated metadata and source revision or timestamp.

**Given** the Profile Config write operation fails midway
**When** the failure is handled
**Then** the previous known-good config remains available
**And** the backend returns a typed recoverable error without leaking full profile content or secrets.

**Given** Profile mutation safety tests run
**When** valid, invalid, missing workspace, unknown-field preservation, malformed existing file, and simulated write-failure cases are executed against fixture workspaces
**Then** tests prove validation, read-after-write, unknown-field preservation where possible, and previous-file survival on failure.

#### Story 2.5: Build Android CV and Profile Editing UI

As a personal mobile app user,
I want Android screens for viewing and editing my CV Markdown and Profile Config,
So that I can manage Career Ops inputs without using the terminal.

**Acceptance Criteria:**

**Given** the Career Ops feature is available in Android
**When** the user navigates to CV/Profile
**Then** the app provides reachable CV and Profile editing surfaces using the existing navigation approach
**And** the screens follow the existing neo-brutalist visual language.

**Given** the CV screen loads successfully
**When** the backend returns CV Markdown content
**Then** Android displays the current content or status clearly
**And** the user can edit and submit Markdown content through the Wrapper Backend.

**Given** the Profile screen loads successfully
**When** the backend returns normalized MVP Profile Fields
**Then** Android displays editable fields using appropriate controls for text, lists, selections, and boolean values
**And** unsupported upstream fields are not shown as editable fields unless explicitly supported by the MVP contract.

**Given** the backend returns missing, invalid, validation, or save-failure states
**When** the CV/Profile UI receives those responses
**Then** the UI displays actionable warnings or errors
**And** it does not discard the previous known-good visible state unnecessarily.

**Given** a save request is in progress
**When** the user interacts with the screen
**Then** the UI shows a non-blocking loading/saving state
**And** duplicate save actions are prevented until the current save resolves.

**Given** the screen is rotated or the ViewModel is recreated
**When** the CV/Profile UI returns
**Then** loaded state, validation state, and unsaved edits survive according to the ViewModel/MVI state model
**And** no backend-only DTOs or Room entities leak into presentation models.

#### Story 2.6: Preserve Cached CV/Profile State on Backend Errors

As a personal mobile app user,
I want the Android app to preserve the latest known CV and Profile state when the backend is temporarily unavailable,
So that I can still understand what was last loaded instead of seeing a blank or misleading screen.

**Acceptance Criteria:**

**Given** Android has successfully loaded CV or Profile data before
**When** a later refresh fails because the wrapper is unreachable, times out, or returns a recoverable backend error
**Then** Android preserves the last-known loaded CV/Profile state
**And** marks the state as stale or not currently refreshed.

**Given** Android has no previously loaded CV or Profile data
**When** the first load fails
**Then** the UI shows an empty/error state appropriate to first-load failure
**And** it does not pretend cached data exists.

**Given** a save request fails validation
**When** the backend returns field-level or structured validation errors
**Then** Android displays the validation error near the relevant field where possible
**And** preserves the user's unsaved edits for correction.

**Given** a save request fails due to network, timeout, or recoverable backend error
**When** the user returns to the CV/Profile screen
**Then** the UI preserves unsaved edits separately from last-known saved data
**And** allows the user to retry after the connection recovers.

**Given** cached state is displayed
**When** the backend later returns fresh CV/Profile data
**Then** Android updates the displayed state from the wrapper source of truth
**And** clears the stale indicator.

**Given** Android repository and ViewModel tests run
**When** stale refresh, first-load failure, validation failure, save retry, and ViewModel recreation cases are exercised
**Then** tests prove cached-state behavior, MVI transitions, and no leakage of DTOs or Room entities into presentation models.

### Epic 3: Configure Search Criteria and Scan Readiness

Hy can manage Portal Config/search criteria from Android and see whether CV, profile, portal config, and workspace health are sufficient to start a real scan.

**FRs covered:** FR8, FR9, FR10

**Key risk gates and dependencies:**

- Reuses the safe file adapter pattern proven in Epic 2; do not duplicate write helpers.
- Extends mutation safety tests to Portal Config, including malformed YAML, oversized payload, and read-after-write.
- Produces scan readiness state that Epic 4 can trust.
- Applies visual consistency incrementally.

#### Story 3.1: Read and Validate Portal Config

As a personal mobile app user,
I want the Android app to load my Career Ops Portal Config as normalized search criteria,
So that I can review which job portals and filters will be used before scanning.

**Acceptance Criteria:**

**Given** the Wrapper Backend is connected to a valid Career Ops Workspace
**When** Android calls the Portal Config read endpoint
**Then** the backend reads the configured portal file only from inside the Career Ops Workspace
**And** returns a normalized Portal DTO containing the MVP Portal Fields defined by the architecture.

**Given** the Portal Config exists and is valid
**When** the read endpoint validates it
**Then** the response follows the checked-in Portal DTO schema
**And** required and optional MVP portal fields are represented consistently for Android rendering.

**Given** the Portal Config contains invalid YAML or invalid structure
**When** the read endpoint validates it
**Then** the backend returns a typed validation error
**And** it does not silently repair, rewrite, or discard the invalid upstream file.

**Given** the Portal Config is missing
**When** the read endpoint is called
**Then** the backend returns an actionable not-ready state
**And** Android can display guidance without pretending scan criteria are configured.

**Given** the upstream Portal Config contains unsupported or unknown fields
**When** the backend normalizes the config
**Then** unknown fields are preserved internally for future save operations where possible
**And** Android receives only supported normalized MVP fields plus metadata needed for freshness/readiness.

**Given** the backend logs the Portal Config read operation
**When** logs are inspected
**Then** logs include operational status only
**And** they do not include secrets, tokens, or full portal configuration content.

#### Story 3.2: Save Portal Config Safely

As a personal mobile app user,
I want to edit and save Portal Config from Android,
So that Career Ops scans use my latest job portals and search criteria without corrupting the existing config.

**Acceptance Criteria:**

**Given** Android submits edited MVP Portal Fields
**When** the backend receives the save request
**Then** the backend validates required fields, supported structure, allowed value formats, and payload size
**And** payloads over `128 KB` are rejected with a typed validation error.

**Given** invalid Portal Config input is submitted
**When** validation fails due to malformed structure, unsupported values, or missing required fields
**Then** the existing Portal Config is not modified
**And** Android receives actionable validation details suitable for display.

**Given** the existing Portal Config contains unsupported or unknown upstream fields
**When** the backend saves supported MVP field changes
**Then** it preserves unknown fields where possible
**And** only the supported edited fields are intentionally changed.

**Given** a valid Portal Config save request is received
**When** the backend writes the config file
**Then** it writes only inside the configured Career Ops Workspace
**And** it backs up or preserves the previous known-good config before replacing the active file.

**Given** the Portal Config write operation succeeds
**When** the save endpoint returns
**Then** the backend performs read-after-write verification
**And** returns the saved normalized Portal DTO with updated metadata and source revision or timestamp.

**Given** the Portal Config write operation fails midway
**When** the failure is handled
**Then** the previous known-good config remains available
**And** the backend returns a typed recoverable error without leaking full portal config content or secrets.

**Given** Portal mutation safety tests run
**When** valid, invalid YAML, oversized payload, missing workspace, unknown-field preservation, and simulated write-failure cases are executed against fixture workspaces
**Then** tests prove validation, read-after-write, unknown-field preservation where possible, and previous-file survival on failure.

#### Story 3.3: Build Android Portal Config Editing UI

As a personal mobile app user,
I want an Android screen for editing Portal Config search criteria,
So that I can control which job portals and filters Career Ops uses without manually editing YAML.

**Acceptance Criteria:**

**Given** the Career Ops feature is available in Android
**When** the user navigates to Portal Config
**Then** the app provides a reachable Portal Config editing surface using the existing navigation approach
**And** the screen follows the existing neo-brutalist visual language.

**Given** the Portal Config screen loads successfully
**When** the backend returns normalized MVP Portal Fields
**Then** Android displays editable fields using appropriate controls for portal enablement, keywords, locations, filters, and other MVP-supported search criteria
**And** unsupported upstream fields are not shown as editable unless explicitly supported by the MVP contract.

**Given** the Portal Config is missing, invalid, or not ready
**When** the UI receives the backend response
**Then** the screen shows a distinct actionable state for missing config, invalid YAML/config, validation failure, or backend error
**And** it does not silently repair the config or hide the error.

**Given** the user edits Portal Config fields
**When** validation warnings are returned by the backend
**Then** Android displays warnings near the relevant fields where possible
**And** preserves the user's unsaved edits for correction.

**Given** a save request is in progress
**When** the user interacts with the Portal Config screen
**Then** the UI shows a non-blocking saving state
**And** duplicate save actions are prevented until the current save resolves.

**Given** the screen is rotated or the ViewModel is recreated
**When** the Portal Config UI returns
**Then** loaded state, validation state, and unsaved edits survive according to the ViewModel/MVI state model
**And** no backend-only DTOs or Room entities leak into presentation models.

#### Story 3.4: Compute Scan Readiness from Workspace Inputs

As a personal mobile app user,
I want the backend to compute scan readiness from all required Career Ops inputs,
So that the app can prevent scan attempts that are guaranteed to fail.

**Acceptance Criteria:**

**Given** the Wrapper Backend is connected to a Career Ops Workspace
**When** Android calls the scan readiness endpoint or receives readiness from a supported endpoint
**Then** the backend evaluates wrapper health, workspace readiness, Career Ops engine readiness, CV readiness, Profile Config readiness, and Portal Config readiness
**And** returns a typed readiness DTO suitable for Android display and scan gating.

**Given** all required inputs are present and valid
**When** scan readiness is computed
**Then** the response marks scan readiness as ready
**And** includes concise success messages or checks for each required input category.

**Given** one or more required inputs are missing, invalid, unreadable, or not ready
**When** scan readiness is computed
**Then** the response marks scan readiness as not ready
**And** includes distinct readiness messages for workspace, scanner, CV, profile, and portal causes.

**Given** a readiness check encounters invalid upstream config
**When** validation fails for Profile Config or Portal Config
**Then** the backend reports the validation category clearly
**And** it does not repair, rewrite, or discard upstream files during readiness checks.

**Given** readiness computation reads source files
**When** file access is performed
**Then** all reads stay inside the configured Career Ops Workspace
**And** logs do not include full CV, profile, portal content, secrets, or local pairing tokens.

**Given** backend readiness tests run
**When** fixture workspaces represent ready, missing CV, missing profile, invalid profile, missing portal, invalid portal, invalid workspace, unavailable scanner, and mixed-failure cases
**Then** tests prove readiness status and distinct messages for each case.

#### Story 3.5: Display Scan Readiness and Block Invalid Scan Starts

As a personal mobile app user,
I want the Android app to show scan readiness and disable scan actions when required inputs are not ready,
So that I can fix setup or config issues before starting a real Career Ops scan.

**Acceptance Criteria:**

**Given** the user navigates to the scan or readiness surface
**When** Android loads scan readiness from the Wrapper Backend
**Then** the UI displays readiness for wrapper/workspace, scanner, CV, Profile Config, and Portal Config
**And** loading, ready, not-ready, stale, and error states follow the existing neo-brutalist visual language.

**Given** scan readiness is ready
**When** the readiness UI is displayed
**Then** the scan start action is enabled
**And** the UI clearly indicates that the required inputs are valid enough to start a scan.

**Given** scan readiness is not ready
**When** one or more required inputs fail readiness
**Then** the scan start action is disabled
**And** the UI shows distinct actionable messages for each failing input category.

**Given** readiness cannot be refreshed because the wrapper is unreachable or returns a recoverable backend error
**When** Android has a previous readiness state
**Then** the UI marks the previous state as stale
**And** it does not enable scan start based on stale readiness alone.

**Given** readiness cannot be refreshed and no previous readiness state exists
**When** the user opens the readiness surface
**Then** the UI shows a first-load error state
**And** scan start remains disabled.

**Given** the user edits CV, Profile Config, Portal Config, or wrapper connection settings
**When** the edit is saved successfully
**Then** Android refreshes scan readiness or marks the previous readiness as needing refresh
**And** scan start uses the latest readiness result before proceeding.

**Given** Android repository and ViewModel tests run
**When** ready, not-ready, stale, first-load failure, post-save refresh, and ViewModel recreation cases are exercised
**Then** tests prove scan readiness state transitions and disabled/enabled scan action behavior.

### Epic 4: Run a Real Career Ops Scan

Hy can start one real Career Ops scan from Android, monitor progress, handle conflicts/failures, and preserve auditable Real First evidence.

**FRs covered:** FR11, FR12, FR13

**Key risk gates and dependencies:**

- Owns ScanRun lifecycle, allowlisted `career-ops-engine` scan operation, conflict handling, sanitized run logs, and persisted run metadata.
- Must include state-machine tests: `idle -> running -> succeeded`, `idle -> running -> failed`, concurrent scan returns `409 SCAN_ALREADY_RUNNING`, and wrapper restart recovery behavior.
- Must distinguish command execution failure from later parser/projector failure.
- Must not scope-creep into full offer projection; detailed Offer projection belongs mainly in Epic 5.

#### Story 4.1: Start a Real Allowlisted Career Ops Scan Run

As a personal mobile app user,
I want to start a real Career Ops scan from Android when readiness passes,
So that I can search job offers without using the CLI directly.

**Acceptance Criteria:**

**Given** scan readiness is ready
**When** Android submits a scan start request
**Then** the Wrapper Backend creates a stable ScanRun ID
**And** starts the real Career Ops scan through an allowlisted `career-ops-engine.runScan()` operation backed by `node scan.mjs` or equivalent `npm run scan` in the configured Career Ops Workspace.

**Given** a scan start request is received
**When** the backend prepares scanner execution
**Then** it does not accept arbitrary command strings, shell fragments, script paths, or user-provided executable names from Android
**And** no generic command execution endpoint is introduced
**And** it does not use Antigravity/Claude/Gemini/Codex slash-command automation or standalone provider API-key evaluator scripts for the MVP scan path.

**Given** the real scanner starts successfully
**When** the scan start endpoint returns
**Then** the backend returns an initial ScanRun DTO without waiting for scan completion
**And** the DTO includes run ID, status, timestamps, and links or instructions for polling status.

**Given** scan readiness is not ready
**When** Android submits a scan start request
**Then** the backend rejects the request with a typed readiness error
**And** no scanner process is started.

**Given** scanner startup fails before execution begins
**When** the backend handles the failure
**Then** the ScanRun is marked failed or not-started according to the ScanRun contract
**And** Android receives a typed error or ScanRun failure state without sensitive workspace details.

**Given** backend scan start tests run
**When** ready, not-ready, command-injection-like input, missing scanner, and startup failure cases are executed
**Then** tests prove only the allowlisted scanner operation can start and scan start returns promptly.

#### Story 4.2: Enforce Single Active Scan Run

As a personal mobile app user,
I want the backend to reject a new scan while another scan is running,
So that Career Ops workspace files and scan outputs are not corrupted by overlapping runs.

**Acceptance Criteria:**

**Given** no scan is currently active
**When** Android submits a valid scan start request
**Then** the backend accepts the request and marks the created ScanRun as the active run
**And** subsequent status polling can retrieve that active run.

**Given** a scan is pending or running
**When** Android submits another scan start request
**Then** the backend rejects the new request with `409 SCAN_ALREADY_RUNNING`
**And** the response includes the active ScanRun ID and current status where safe.

**Given** a scan has succeeded, failed, or been marked terminal
**When** Android submits a new valid scan start request
**Then** the backend allows the new scan to start
**And** it does not treat terminal runs as active conflicts.

**Given** the backend restarts while a scan run record exists
**When** scan manager initializes
**Then** it recovers active-run state according to the persisted ScanRun metadata
**And** it does not incorrectly allow overlapping scanner execution.

**Given** concurrent scan requests arrive at nearly the same time
**When** scan manager processes them
**Then** only one request can create or claim the active ScanRun
**And** all other concurrent requests return `409 SCAN_ALREADY_RUNNING`.

**Given** scan conflict tests run
**When** sequential, terminal, restart-recovery, and near-concurrent request cases are exercised
**Then** tests prove MVP rejects concurrent scans and preserves a single active run invariant.

#### Story 4.3: Track and Persist Scan Run Lifecycle

As a personal mobile app user,
I want each scan run to have a durable lifecycle state,
So that the app can show accurate progress and recover from backend restarts.

**Acceptance Criteria:**

**Given** a scan run is created
**When** the backend records the run
**Then** it persists ScanRun metadata including run ID, status, command type, created/start/end timestamps, exit status when available, and failure summary when applicable
**And** it does not persist full CV/profile/portal content in the run record.

**Given** scanner execution begins
**When** the scan process transitions states
**Then** the ScanRun status moves through valid states such as pending, running, succeeded, or failed
**And** invalid state transitions are rejected or ignored safely.

**Given** the scanner exits successfully
**When** the backend handles completion
**Then** the ScanRun is marked succeeded with end timestamp and exit status
**And** generated output discovery or parsing can be triggered later without changing the scan execution result incorrectly.

**Given** the scanner exits with failure or times out
**When** the backend handles completion
**Then** the ScanRun is marked failed with end timestamp, exit status or timeout category, and sanitized failure summary
**And** Career Ops user-layer files remain uncorrupted by failure handling.

**Given** the Wrapper Backend restarts
**When** scan run storage is loaded
**Then** previous terminal runs remain queryable
**And** any non-terminal run is reconciled into a truthful recoverable state according to the architecture decision.

**Given** ScanRun lifecycle tests run
**When** pending-to-running-to-succeeded, pending-to-running-to-failed, timeout, invalid transition, and restart recovery cases are exercised
**Then** tests prove lifecycle persistence, terminal state handling, and audit metadata correctness.

#### Story 4.4: Poll and Display Scan Run Status on Android

As a personal mobile app user,
I want the Android app to show scan run status while Career Ops is running,
So that I can monitor progress without blocking the mobile UI.

**Acceptance Criteria:**

**Given** Android starts a scan successfully
**When** the backend returns the initial ScanRun DTO
**Then** Android displays the run ID, current status, start or created timestamp, and a non-blocking running state
**And** the UI does not freeze while the scan continues.

**Given** a scan run is pending or running
**When** Android polls the ScanRun status endpoint
**Then** it updates the UI with the latest pending/running/succeeded/failed state
**And** polling stops or slows appropriately once a terminal state is reached.

**Given** the scan succeeds
**When** Android receives a succeeded ScanRun status
**Then** the UI shows completion state and next-step affordance toward offers/results when available
**And** it does not claim offers are parsed until Epic 5 behavior is available.

**Given** the scan fails
**When** Android receives a failed ScanRun status
**Then** the UI shows sanitized failure details and retry guidance
**And** it does not expose full CV, profile, portal content, secrets, or raw unsafe logs.

**Given** the wrapper becomes temporarily unreachable during polling
**When** Android has a previous ScanRun state
**Then** the UI preserves the last-known run state and marks it as temporarily stale or reconnecting
**And** it resumes polling when the connection recovers.

**Given** the scan status screen is rotated or the ViewModel is recreated
**When** the screen returns
**Then** the current ScanRun ID and latest known status survive
**And** polling resumes without starting a duplicate scan.

**Given** Android repository and ViewModel tests run
**When** start success, polling updates, terminal success, terminal failure, unreachable wrapper, and ViewModel recreation cases are exercised
**Then** tests prove non-blocking scan status behavior and correct MVI state transitions.

#### Story 4.5: Preserve Sanitized Scan Logs and Failure Details

As a personal mobile app user,
I want scan failures and logs to be sanitized but still useful,
So that I can debug failed scans without exposing private CV, profile, or secrets.

**Acceptance Criteria:**

**Given** a scan run produces stdout, stderr, process metadata, or failure details
**When** the backend stores or exposes run diagnostics
**Then** it stores only sanitized logs, summaries, or bounded excerpts according to the log-redaction policy
**And** full CV content, profile content, portal secrets, local pairing tokens, provider API keys, and local sensitive paths are not exposed.

**Given** scanner execution fails
**When** Android requests ScanRun status or detail
**Then** the backend returns a failure category, sanitized failure summary, exit status or timeout category, and timestamps where available
**And** the response follows the ScanRun DTO schema.

**Given** a scan succeeds
**When** run diagnostics are inspected
**Then** the run record includes command type, start/end time, exit status, and sanitized operational summary
**And** it does not include unnecessary raw command output.

**Given** logs contain patterns that look like secrets, local pairing tokens, local paths, CV sections, profile fields, or portal credentials
**When** the redaction layer processes logs
**Then** sensitive values are masked or removed before storage and API response
**And** redaction is covered by unit tests.

**Given** Android displays failure details
**When** sanitized details are available
**Then** the UI shows concise debug information and retry guidance
**And** it avoids displaying raw unbounded logs directly in the main status screen.

**Given** scan auditability tests run
**When** successful runs, failed runs, secret-like logs, CV-like logs, token-like logs, and large-log cases are exercised
**Then** tests prove diagnostics remain useful, bounded, and privacy-safe.

#### Story 4.6: Capture Real First Scan Evidence

As a personal mobile app maintainer,
I want documented evidence that Android can trigger a real Career Ops scan through the wrapper,
So that the MVP is credible as a portfolio project and not just mock screens.

**Acceptance Criteria:**

**Given** Epic 4 implementation is complete
**When** the developer performs the Real First scan evidence flow
**Then** the evidence demonstrates Android scan start -> Wrapper Backend -> allowlisted Career Ops scan operation -> ScanRun status polling -> terminal scan state
**And** the flow uses a real or fixture-backed Career Ops Workspace according to the architecture's evidence guidance.

**Given** the evidence flow is documented
**When** a reviewer reads `docs/career-ops-mobile/evidence`
**Then** they can see the commands or steps used, wrapper endpoint involved, ScanRun ID shape, status progression, and sanitized result summary
**And** no CV/profile secrets, local pairing tokens, or sensitive local paths are exposed.

**Given** the scan succeeds
**When** evidence is captured
**Then** the document records the succeeded ScanRun lifecycle and any generated output locations by opaque or safe identifiers
**And** it clearly states that offer projection and detailed result review belong to Epic 5 unless already implemented.

**Given** the scan fails in an expected fixture or controlled scenario
**When** evidence is captured
**Then** the document records the failed ScanRun lifecycle, failure category, sanitized summary, and recovery behavior
**And** it proves failed scans do not corrupt Career Ops user-layer files.

**Given** automated tests are part of the evidence package
**When** the evidence note is updated
**Then** it references relevant backend scan lifecycle/conflict/log-redaction tests and Android polling/ViewModel tests
**And** it does not claim unverified behavior.

### Epic 5: Review Offers from Real Career Ops Outputs

Hy can view and inspect offers parsed from Career Ops pipeline/tracker files with responsive cached UI, clear stale/fresh state, and external job URL handling.

**FRs covered:** FR14, FR15, FR16

**Key risk gates and dependencies:**

- Highest integration-risk epic because it proves parser/projector behavior, DTO drift prevention, Room freshness, and stale/offline Android state.
- Owns parser fixtures, offer snapshot tests, malformed/partial offer behavior, and Android Room cache tests.
- Must prove real or golden Career Ops output can be parsed into Offer DTOs without crashing the entire list.
- Completes the core Real First product-value evidence with Epic 4.

#### Story 5.1: Discover Career Ops Offer Output Sources

As a personal mobile app user,
I want the Wrapper Backend to find Career Ops offer output sources safely,
So that the app can show real scan results instead of mock offers.

**Acceptance Criteria:**

**Given** a Career Ops Workspace with scan outputs
**When** the backend performs offer source discovery
**Then** it searches only approved Career Ops pipeline/tracker/output locations inside the configured workspace
**And** returns discovered source metadata without exposing unsafe absolute local paths.

**Given** no scan has run or no offer output files exist
**When** offer source discovery runs
**Then** the backend returns a distinct no-output or not-generated state
**And** Android can distinguish this from backend failure.

**Given** output paths include symlinks, traversal attempts, unsupported file types, or files outside the workspace
**When** discovery resolves candidate paths
**Then** unsafe candidates are rejected
**And** no out-of-workspace file is read or served.

**Given** multiple supported output files exist
**When** discovery runs
**Then** the backend records source identifiers, modified timestamps, format hints, and safe source revisions where available
**And** it can choose or merge sources according to the architecture parser strategy.

**Given** discovery encounters malformed, unreadable, or partially written output files
**When** discovery completes
**Then** the backend reports source-level warnings where safe
**And** it does not fail the entire offer flow unless no usable source remains.

**Given** output discovery tests run
**When** fixture workspaces include no output, valid tracker output, valid pipeline output, unsupported files, out-of-workspace paths, and partially written files
**Then** tests prove discovery is workspace-boundary safe and returns distinct source states.

#### Story 5.2: Parse Career Ops Outputs into Offer DTOs

As a personal mobile app user,
I want Career Ops outputs parsed into consistent offer records,
So that I can review job opportunities in the Android app.

**Acceptance Criteria:**

**Given** one or more supported Career Ops offer output sources are discovered
**When** the backend parses them
**Then** it produces normalized Offer DTOs containing all minimum fields required by the architecture
**And** optional fields are included only when present and valid.

**Given** an output record contains missing optional fields
**When** parsing runs
**Then** the backend still returns a valid Offer DTO
**And** Android can render the offer without placeholder corruption or crashes.

**Given** an output record is malformed, incomplete, duplicated, or unsupported
**When** parsing runs
**Then** the backend skips, normalizes, or marks the problematic record according to parser rules
**And** one bad record does not crash the entire offer list.

**Given** multiple output sources contain overlapping offers
**When** parsing and projection run
**Then** the backend produces stable offer IDs or deterministic deduplication behavior
**And** source metadata remains traceable enough for debugging.

**Given** parser warnings are generated
**When** the backend returns offers
**Then** warnings are summarized safely without exposing sensitive CV/profile content, local pairing tokens, secrets, or unsafe local paths.

**Given** parser fixture tests run
**When** golden output, missing optional fields, malformed rows, duplicates, empty outputs, unsupported formats, and mixed-quality sources are exercised
**Then** tests prove Offer DTO shape, parser resilience, deterministic IDs, and safe warning behavior.

#### Story 5.3: Expose Offer List and Offer Detail APIs

As a personal mobile app user,
I want the Android app to retrieve offer lists and offer details from the Wrapper Backend,
So that I can inspect real Career Ops scan results through stable APIs.

**Acceptance Criteria:**

**Given** parsed offers are available
**When** Android calls the offer list endpoint
**Then** the backend returns a collection of Offer DTOs following the checked-in API schema
**And** each offer includes minimum fields, optional fields when present, source metadata, and freshness or revision metadata where defined.

**Given** no scan has run or no offer output has been generated
**When** Android calls the offer list endpoint
**Then** the backend returns a distinct empty/not-generated response state
**And** Android can distinguish no scan yet from scan completed with zero offers.

**Given** parsing completes with recoverable source warnings
**When** Android calls the offer list endpoint
**Then** the backend returns usable offers with safe warning summaries
**And** it does not expose sensitive CV/profile content, secrets, local pairing tokens, or unsafe local paths.

**Given** Android requests a specific offer detail by ID
**When** the offer exists in the current backend projection
**Then** the backend returns the complete Offer DTO for that offer
**And** missing optional fields remain absent or null according to the schema.

**Given** Android requests an unknown or stale offer ID
**When** the backend cannot find that offer
**Then** it returns a typed not-found or stale-offer error
**And** Android can return the user to the refreshed offer list.

**Given** backend contract tests run
**When** offer list, offer detail, empty/not-generated, parser-warning, not-found, and malformed-source cases are exercised
**Then** tests prove API contract stability and safe error behavior.

#### Story 5.4: Cache Latest Offers in Android Room Projection

As a personal mobile app user,
I want the Android app to cache the latest offers locally,
So that the offer list remains responsive and understandable when the wrapper is temporarily unreachable.

**Acceptance Criteria:**

**Given** Android successfully refreshes offers from the Wrapper Backend
**When** the repository receives Offer DTOs
**Then** it maps DTOs into domain models and Room projection entities
**And** stores latest offers with freshness metadata such as `syncedAt`, `sourceRevision`, and `isStale`.

**Given** offers are stored in Room
**When** the app reads the offer list
**Then** presentation models are built from domain models
**And** API DTOs and Room entities do not leak into UI state.

**Given** the wrapper is temporarily unreachable after offers were previously cached
**When** Android loads the offer list
**Then** the app displays cached offers
**And** marks them as stale or offline rather than fresh.

**Given** the wrapper returns fresh offers after a stale state
**When** Android refreshes successfully
**Then** Room projection is updated from wrapper data
**And** stale indicators are cleared.

**Given** the wrapper returns an empty/not-generated offer response
**When** Android refreshes successfully
**Then** the Room projection updates to reflect the wrapper source of truth
**And** previously cached offers are not shown as fresh current results.

**Given** Android repository and Room tests run
**When** fresh refresh, stale fallback, empty refresh, source revision change, mapper behavior, and ViewModel recreation cases are exercised
**Then** tests prove projection cache correctness and source-of-truth behavior.

#### Story 5.5: Build Android Offer List with Fresh, Empty, and Stale States

As a personal mobile app user,
I want an Android offer list that clearly shows current, empty, and cached states,
So that I understand whether Career Ops found offers and whether the list is fresh.

**Acceptance Criteria:**

**Given** the user navigates to the Offer List screen
**When** offers are loading from the Wrapper Backend or Room projection
**Then** the UI shows a non-blocking loading state
**And** the screen follows the existing neo-brutalist visual language.

**Given** the backend reports no scan has run or outputs are not generated
**When** the Offer List screen renders
**Then** the UI shows a distinct no-scan/not-generated state
**And** it does not imply that a completed scan found zero offers.

**Given** the backend reports a completed scan with zero offers
**When** the Offer List screen renders
**Then** the UI shows a distinct zero-offers state
**And** it provides appropriate next-step guidance without fabricating offers.

**Given** fresh offers are available
**When** the Offer List screen renders
**Then** the UI displays offer cards or rows with key fields such as title, company, location, source, status, date, and optional salary or match metadata where available
**And** text fits within list items without overlapping controls.

**Given** only cached offers are available because the wrapper is unreachable
**When** the Offer List screen renders
**Then** the UI displays cached offers with a stale/offline indicator
**And** refresh retry remains available.

**Given** parser warnings are returned with usable offers
**When** the Offer List screen renders
**Then** Android shows a concise warning state or banner
**And** the list remains usable.

**Given** Android UI/ViewModel tests run
**When** loading, no-scan, zero-offers, fresh offers, stale cached offers, parser warning, backend error, and ViewModel recreation cases are exercised
**Then** tests prove correct state rendering and MVI transitions.

#### Story 5.6: Build Android Offer Detail and External URL Handling

As a personal mobile app user,
I want to open an offer detail view and launch the original job URL externally,
So that I can inspect the opportunity and continue application steps outside the app.

**Acceptance Criteria:**

**Given** the user taps an offer from the Offer List
**When** the offer exists in current domain state or can be refreshed by ID
**Then** Android opens an Offer Detail screen
**And** displays all minimum Offer DTO fields and optional fields when present.

**Given** optional offer fields are missing
**When** the Offer Detail screen renders
**Then** the UI gracefully omits or marks those fields according to presentation rules
**And** it does not show misleading placeholder values.

**Given** the offer includes a valid external job URL
**When** the user taps the open-job action
**Then** Android launches the URL through an external intent
**And** the MVP does not embed an in-app browser.

**Given** the offer URL is missing, invalid, or unsupported
**When** the Offer Detail screen renders
**Then** the open-job action is hidden or disabled with clear state
**And** no invalid intent is launched.

**Given** Android requests an offer detail that is no longer available from the backend
**When** the backend returns not-found or stale-offer error
**Then** Android shows a recoverable state
**And** offers a way to refresh or return to the Offer List.

**Given** Android tests run
**When** full detail, missing optional fields, valid external URL, invalid URL, stale offer, and ViewModel recreation cases are exercised
**Then** tests prove detail rendering and external intent behavior.

#### Story 5.7: Prove Offer Projection with Fixtures and Real First Evidence

As a personal mobile app maintainer,
I want fixture and evidence coverage for offer projection,
So that the portfolio proves real Career Ops outputs become usable Android offer screens.

**Acceptance Criteria:**

**Given** Epic 5 implementation is complete
**When** the developer runs backend parser and API tests
**Then** fixture workspaces prove valid Career Ops output can be discovered, parsed into Offer DTOs, and returned through offer list/detail APIs
**And** malformed or partial outputs do not crash the entire flow.

**Given** Android offer tests run
**When** checked-in contract examples and fixture-backed API responses are parsed
**Then** Android proves DTO deserialization, repository mapping, Room projection freshness, stale fallback, list UI states, and detail UI states.

**Given** a Real First scan has generated offer-related outputs or a golden Career Ops output fixture is used
**When** evidence is updated under `docs/career-ops-mobile/evidence`
**Then** the evidence shows Wrapper Backend output discovery -> parser projection -> offer API response -> Android Room refresh -> offer list/detail rendering
**And** it identifies whether the source was real local output or a golden fixture.

**Given** evidence includes screenshots, logs, or response snippets
**When** a reviewer reads the evidence
**Then** sensitive CV/profile content, local pairing tokens, secrets, and unsafe local paths are redacted
**And** the evidence remains clear enough to understand the integration flow.

**Given** offer projection has known limitations
**When** evidence or implementation notes are reviewed
**Then** unsupported Career Ops output formats, parser assumptions, and future improvements are documented
**And** MVP completion is not claimed for unsupported formats.

### Epic 6: View Supporting Outputs and Complete the Portfolio Demo

Hy can view reports/artifacts when Career Ops produces them and complete a coherent neo-brutalist demo flow across all MVP surfaces.

**FRs covered:** FR17, FR18, FR19, FR20

**Key risk gates and dependencies:**

- Reports/artifacts are view-if-present and must not become a full document manager.
- Owns output ID resolver behavior, artifact path boundary tests, report rendering, missing output states, and final navigation coherence.
- Does not become the first place UI quality is tested; visual consistency must have been applied incrementally in Epics 1-5.
- Completes final portfolio/demo coherence and evidence packaging.

#### Story 6.1: Discover and Expose Reports and Artifacts

As a personal mobile app user,
I want the app to list reports and artifacts generated by Career Ops,
So that I can inspect supporting scan outputs when they exist.

**Acceptance Criteria:**

**Given** a Career Ops Workspace with generated reports or artifacts
**When** the backend performs output discovery
**Then** it searches only approved report and artifact locations inside the configured workspace
**And** returns Report and Artifact DTOs with safe opaque IDs, display names, types, timestamps, sizes where available, and offer links when known.

**Given** no reports or artifacts have been generated
**When** Android calls the reports/artifacts endpoint
**Then** the backend returns a distinct not-generated state
**And** Android can distinguish it from backend error.

**Given** generated outputs include unsupported file types, unreadable files, symlinks, traversal attempts, or out-of-workspace paths
**When** discovery resolves candidates
**Then** unsafe or unsupported candidates are rejected
**And** no out-of-workspace file is read, listed, downloaded, or served.

**Given** reports or artifacts can be linked to offers
**When** output discovery runs
**Then** the backend includes safe offer linkage metadata where known
**And** it does not require every output to be linked to an offer.

**Given** discovery encounters partially written or malformed output metadata
**When** discovery completes
**Then** the backend returns usable outputs with safe warnings where possible
**And** it does not fail the whole listing unless no usable output remains.

**Given** backend tests run
**When** fixture workspaces include no outputs, markdown reports, downloadable artifacts, linked outputs, unsupported files, out-of-workspace paths, and partial metadata
**Then** tests prove output discovery, DTO shape, not-generated state, and workspace-boundary behavior.

#### Story 6.2: Serve Artifact Downloads Through Safe Opaque IDs

As a personal mobile app user,
I want downloadable artifacts to be served through safe backend IDs,
So that I can open generated files without exposing or trusting local file paths.

**Acceptance Criteria:**

**Given** an Artifact DTO is returned by the backend
**When** Android requests the artifact by opaque ID
**Then** the backend resolves the ID to a file only inside the configured Career Ops Workspace
**And** Android never sends or receives an absolute local workspace path.

**Given** the artifact exists and is supported for MVP download/open behavior
**When** Android requests the artifact content
**Then** the backend streams or returns the file with safe content type, filename, size metadata where available, and cache behavior defined by the contract
**And** the response does not expose sensitive local paths.

**Given** the artifact ID is unknown, expired, stale, or points to a missing file
**When** Android requests the artifact
**Then** the backend returns a typed not-found or missing-file error
**And** Android can show a clear missing artifact state.

**Given** an artifact candidate resolves through symlink, traversal, absolute path, unsupported extension, or out-of-workspace target
**When** the resolver checks the candidate
**Then** the backend rejects the request
**And** no unsafe file is read, downloaded, or served.

**Given** artifact download tests run
**When** valid artifact, missing file, unknown ID, traversal attempt, symlink escape, unsupported file type, and large-file boundary cases are exercised
**Then** tests prove artifact serving is workspace-boundary safe and error states are typed.

#### Story 6.3: Build Android Reports and Artifacts UI

As a personal mobile app user,
I want an Android screen for reports and artifacts,
So that I can browse supporting Career Ops outputs when they are available.

**Acceptance Criteria:**

**Given** the Career Ops feature is available in Android
**When** the user navigates to Reports and Artifacts
**Then** the app provides a reachable reports/artifacts surface using the existing navigation approach
**And** the screen follows the existing neo-brutalist visual language.

**Given** reports or artifacts are available
**When** the screen renders
**Then** Android displays output items with display name, type, generated or modified timestamp where available, linked offer information when known, and clear actions.

**Given** no reports or artifacts have been generated
**When** the screen renders
**Then** Android shows a distinct not-generated state
**And** it does not present that state as a backend error.

**Given** the backend returns missing file, unsupported file, validation, or workspace-boundary errors
**When** the screen receives those responses
**Then** Android shows actionable error states
**And** it does not expose unsafe local file paths.

**Given** the wrapper is temporarily unreachable after outputs were previously loaded
**When** Android opens the Reports and Artifacts screen
**Then** the UI preserves last-known output metadata where available
**And** marks it stale or unavailable for refresh as appropriate.

**Given** Android UI/ViewModel tests run
**When** loading, generated outputs, not-generated, missing file, backend error, stale metadata, and ViewModel recreation cases are exercised
**Then** tests prove correct state rendering and MVI transitions.

#### Story 6.4: Render Markdown Reports In-App

As a personal mobile app user,
I want to open Markdown reports inside the Android app,
So that I can read generated Career Ops summaries without leaving the MVP flow.

**Acceptance Criteria:**

**Given** a Report DTO references a Markdown report
**When** the user opens the report
**Then** Android requests report content through the Wrapper Backend using the safe report ID
**And** renders the Markdown content in-app using the approved MVP rendering approach.

**Given** report content is returned
**When** Android renders it
**Then** headings, paragraphs, lists, links, and code-style blocks render readably within the existing visual system
**And** long text wraps without overlapping controls or escaping containers.

**Given** the report contains links
**When** the user taps an external link
**Then** Android opens it through an external intent when allowed by presentation rules
**And** the MVP does not embed a browser.

**Given** the report is missing, unsupported, too large for MVP rendering, or fails workspace-boundary validation
**When** Android attempts to open it
**Then** the UI shows a clear recoverable state
**And** no unsafe file content is displayed.

**Given** report rendering tests run
**When** valid Markdown, empty report, long report, missing report, unsupported file, link handling, and ViewModel recreation cases are exercised
**Then** tests prove safe report loading and readable rendering behavior.

#### Story 6.5: Complete MVP Navigation Across Career Ops Surfaces

As a personal mobile app user,
I want all MVP Career Ops surfaces to be reachable through a coherent Android flow,
So that I can complete setup, input preparation, scan, review, and output inspection without terminal-only steps.

**Acceptance Criteria:**

**Given** the Career Ops feature is opened
**When** the user navigates through the app
**Then** setup, CV/Profile, Portal Config, Scan Status, Offer List, Offer Detail, and Reports/Artifacts surfaces are reachable through the existing navigation structure
**And** navigation labels and destinations are consistent with the app's current UI patterns.

**Given** wrapper health or scan readiness is not ready
**When** the user attempts to access scan-dependent surfaces
**Then** the app provides appropriate blocked, empty, or setup guidance states
**And** it does not create terminal-only dead ends inside the mobile workflow.

**Given** the user completes setup and input preparation
**When** scan readiness becomes ready
**Then** the user can proceed to scan status and then review offers or supporting outputs through Android navigation.

**Given** the user opens an external job URL or downloadable artifact
**When** control leaves the app through an external intent
**Then** returning to the app preserves the relevant Career Ops screen state where practical.

**Given** navigation tests or manual evidence flows run
**When** UJ-1 through UJ-4 are exercised
**Then** the evidence proves the MVP can be demonstrated without requiring terminal actions except backend startup and external job URLs.

#### Story 6.6: Finalize Neo-Brutalist Visual Consistency

As a personal mobile app user,
I want Career Ops screens to feel consistent with the existing app style,
So that the MVP looks intentional rather than bolted on.

**Acceptance Criteria:**

**Given** all Career Ops MVP screens are implemented
**When** visual consistency is reviewed
**Then** setup, CV/Profile, Portal Config, Scan Status, Offer List, Offer Detail, and Reports/Artifacts screens reuse the existing neo-brutalist visual language
**And** bold borders, hard shadows, saturated accents, compact surfaces, expressive buttons, and existing theme colors remain consistent.

**Given** loading, empty, error, warning, stale, success, and disabled states appear across Career Ops screens
**When** those states render
**Then** they use consistent visual primitives and wording patterns
**And** users can distinguish not-ready, not-generated, zero-result, stale-cache, backend-error, and validation-error states.

**Given** content varies in length
**When** long CV snippets, portal values, offer titles, company names, report titles, error messages, or artifact names render
**Then** text wraps or truncates professionally
**And** UI elements do not overlap across supported phone sizes.

**Given** accessibility and usability checks run
**When** key Career Ops screens are inspected
**Then** important actions have clear labels, disabled states are understandable, touch targets are practical, and color is not the only indicator of state.

**Given** final UI verification is captured
**When** screenshots or manual notes are added to evidence
**Then** they show the main MVP screens in a coherent visual flow
**And** they do not expose private CV/profile content or tokens.

#### Story 6.7: Package Portfolio Evidence and Implementation Notes

As a personal mobile app maintainer,
I want final evidence and implementation notes packaged clearly,
So that the project communicates Real First integration quality to future reviewers and employers.

**Acceptance Criteria:**

**Given** MVP implementation is complete
**When** the final evidence package is prepared
**Then** `docs/career-ops-mobile/evidence` summarizes the Android to Wrapper Backend to Career Ops Workspace flow across setup, inputs, readiness, scan, offers, and outputs
**And** the evidence distinguishes implemented behavior from deferred or future work.

**Given** a reviewer reads the repository documentation
**When** they inspect the Career Ops Mobile notes
**Then** they can understand architecture decisions, how to run the wrapper, how to configure Android dev/prod modes, what tests prove, and what limitations remain
**And** the documentation avoids overstating unsupported Career Ops output formats or future MarkItDown/Gemini behavior.

**Given** test and evidence references are collected
**When** the implementation notes are updated
**Then** they reference backend unit/integration tests, fixture workspace tests, Android repository/ViewModel tests, contract examples, and manual Real First evidence
**And** missing evidence is called out explicitly rather than implied complete.

**Given** sensitive local data may appear in screenshots, logs, responses, or notes
**When** final evidence is reviewed
**Then** CV/profile content, local pairing tokens, provider API keys, secrets, unsafe local paths, and personal data are redacted
**And** the remaining evidence is still useful for portfolio review.

**Given** the final demo flow is reviewed
**When** setup, CV/Profile, Portal Config, Scan Status, Offer List, Offer Detail, and Reports/Artifacts are exercised
**Then** the MVP demonstrates a coherent personal Android app backed by real Career Ops behavior
**And** no mock-only completion claims remain.

### Epic Exit Gates

- Epic 1 is complete only when the wrapper API foundation, health endpoint, runtime workspace validation, Android dev/prod connection setup, and contract example tests are all demonstrable.
- Epic 2 is complete only when CV/Profile read-save flows prove validation, backup or previous-file preservation, read-after-write, and cached Android error behavior.
- Epic 3 is complete only when Portal Config read-save flows prove malformed YAML handling, 128 KB rejection, previous-file preservation, and scan readiness gating.
- Epic 4 is complete only when a real allowlisted scan can be started, concurrent scans are rejected, lifecycle state is persisted, sanitized logs are available, and Real First scan evidence exists.
- Epic 5 is complete only when Career Ops output fixtures or real outputs prove discovery, parser projection, offer APIs, Android Room cache freshness, stale fallback, and offer detail/external URL behavior.
- Epic 6 is complete only when reports/artifacts are viewable if present, artifact/report access uses opaque workspace-boundary-safe IDs, MVP navigation is coherent, visual consistency is verified, and portfolio evidence is redacted.

### Implementation Guardrails

- No story may be accepted as complete using mock-only behavior for core wrapper, workspace, scan, offer, or output flows.
- Backend contract examples must be updated before Android DTO parsing tests are considered complete.
- Shared file safety behavior should be implemented once and reused for CV, Profile Config, and Portal Config where practical.
- Stale Android state may be displayed for user context, but stale readiness must never enable scan start.
- Opaque output IDs must not encode absolute paths, relative traversal paths, or sensitive local workspace details.
- Readiness responses must include provenance such as `computedAt`, input revision/hash/mtime where practical, and per-input failure reasons; Android must invalidate cached readiness after CV, Profile Config, Portal Config, or connection settings change.
- Scan run concurrency must be enforced server-side through persisted state, lock semantics, or equivalent recovery behavior; in-memory flags alone are not sufficient for MVP completion.
- The allowlisted scan adapter must define command type, fixed script mapping (`scan` -> `node scan.mjs` or equivalent `npm run scan`), args, cwd, environment handling, timeout behavior, stdout/stderr capture, and redaction boundaries.
- Fixture workspaces must include at minimum: empty workspace, valid workspace with CV/Profile/Portal, invalid YAML, oversized Portal Config, workspace with offer/report/artifact outputs, and interrupted or stale active scan state.
- Golden offer parser fixtures must cover complete offer, missing optional fields, malformed or partial output, duplicate offer identity, and invalid external URL cases.
- Artifact/report ID negative tests must cover `../`, absolute paths, URL-encoded traversal, unknown IDs, renamed/deleted files between list and detail, and no filesystem disclosure in errors.
- Readiness UI must render a checklist for workspace, scanner, CV, Profile Config, Portal Config, and active scan state, with direct actions toward the relevant fix where practical.
- Mobile Markdown/YAML editing must remain utilitarian for MVP: edit text, validate, save, show backup/read-after-write confirmation, and surface error line/details when available; rich editing is out of scope.
- Final portfolio evidence must include a redacted end-to-end transcript or walkthrough: connect workspace, edit inputs, readiness pass, real scan, parsed offers, and report/artifact view.

### Cross-Cutting NFR Ownership

- Contract schemas and backend foundation begin in Epic 1.
- File safety is enforced in Epics 2 and 3.
- Command allowlist and scan auditability are enforced in Epic 4.
- Parser reliability, fixture workspaces, and cache freshness are proven in Epic 5.
- Visual consistency is applied incrementally in each Android epic, with final demo coherence completed in Epic 6.
- Security regression tests start in Epic 1 and are extended by scan/output stories in Epics 4-6.
- Fixture workspace ownership starts in Epic 1 and expands through Epics 2-5.
- Real First evidence starts with fixtures in Epic 1 and is proven end-to-end by Epic 4/Epic 5.
