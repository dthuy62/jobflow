---
title: Career Ops Mobile
status: final
created: 2026-06-14
updated: 2026-06-14
---

# PRD: Career Ops Mobile

## 0. Document Purpose

This PRD defines the MVP for Career Ops Mobile: a personal Android app that makes the open-source Career Ops workflow usable from mobile while preserving real integration with the Career Ops workspace and Node.js scripts. It is written for the product owner/developer, downstream BMad architecture work, story creation, and future GitHub/CV presentation. Technical implementation depth that belongs in architecture is captured in [addendum.md](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/addendum.md); this PRD focuses on product behavior, scope, requirements, guardrails, and acceptance criteria.

## 1. Vision

Career Ops Mobile turns Career Ops from a powerful CLI/workspace tool into a personal mobile control surface for job-search operations. The product lets the user connect to a local Wrapper Backend, manage their CV/profile/search configuration, trigger real job scans, and review discovered offers from an Android app that keeps the existing neo-brutalist visual language of the current codebase.

The MVP is not a mock portfolio shell. It must prove real integration and business logic: the wrapper reads and writes actual Career Ops files, executes allowlisted Career Ops scripts, protects the workspace from unsafe writes, and returns normalized data that Android can display. UI polish matters, but the project exists primarily to demonstrate professional mobile engineering, integration discipline, and practical career tooling.

The product also has a portfolio purpose. It should refresh the user's GitHub profile, demonstrate mobile skills, and become a credible CV/resume proof point while supporting the user's own job search.

## 2. Target User

### 2.1 Jobs To Be Done

- As a job-seeking mobile developer, I want to operate my Career Ops workflow from my phone so that job scanning and offer review feel less tied to a terminal session.
- As a portfolio builder, I want the project to show real integration, testing, and architecture discipline so that it strengthens my GitHub and CV.
- As a solo user, I want my CV/profile/job-search data to stay local/private so that I can experiment without creating accounts or exposing sensitive data.
- As a learner, I want the implementation to exercise Android app architecture, backend API design, file-safe integration, and real business logic rather than only UI screens.

### 2.2 Non-Users (v1)

- Multi-user teams.
- Public SaaS users.
- Recruiters or hiring teams using a shared dashboard.
- Users who want a phone-only app with no companion backend.
- Users who need fully automated job applications in v1.

### 2.3 Key User Journeys

- **UJ-1. Hy connects the mobile app to a real Career Ops workspace.**
  - **Persona + context:** Hy is building a personal Android portfolio app and wants a real integration, not demo-only screens.
  - **Entry state:** Career Ops is installed locally; the Wrapper Backend is running or ready to run.
  - **Path:** Hy opens the app, uses the configured wrapper endpoint, checks connection health, and sees whether Career Ops workspace prerequisites are valid.
  - **Climax:** The app shows a connected state with workspace health, required file status, and available capabilities.
  - **Resolution:** Hy can proceed to CV/profile/search configuration with confidence that the backend is real.
  - **Edge case:** If the wrapper is unreachable or workspace validation fails, the app shows the failing check and does not pretend setup succeeded.

- **UJ-2. Hy prepares CV and profile inputs before scanning.**
  - **Persona + context:** Hy wants Career Ops to search based on accurate personal career data.
  - **Entry state:** The app is connected to the wrapper.
  - **Path:** Hy uploads or edits CV Markdown, updates profile fields, reviews saved values, and saves changes through the backend.
  - **Climax:** The wrapper confirms the corresponding Career Ops files were written safely and can be read back.
  - **Resolution:** The app shows CV/profile readiness and any validation warnings.
  - **Edge case:** If a save would corrupt or invalidate a file, the wrapper rejects it and the app keeps the previous known-good state.

- **UJ-3. Hy configures job scanning and runs a real scan.**
  - **Persona + context:** Hy wants to search offers from configured job sources instead of manually browsing.
  - **Entry state:** CV/profile are ready; portal/search config is missing or stale.
  - **Path:** Hy edits title filters, location filters, tracked companies, or search queries; saves config; starts a scan; waits while the app polls run status.
  - **Climax:** The scan completes by executing the real Career Ops scanner, and new offers appear in the mobile offer list.
  - **Resolution:** Hy can review offers and decide what to inspect next.
  - **Edge case:** If a scan partially fails, the app reports failed source(s), preserves successful results, and keeps the scan run auditable.

- **UJ-4. Hy reviews offers as a portfolio-grade mobile workflow.**
  - **Persona + context:** Hy wants the app to demonstrate polished Android UX on top of real job-search data.
  - **Entry state:** At least one scan run has completed.
  - **Path:** Hy opens the offer list, filters or scans high-level details, opens an offer, and views associated report/artifact links when available.
  - **Climax:** The app presents useful offer details sourced from Career Ops files, not mocked static cards.
  - **Resolution:** Hy has a mobile review queue and a strong demo flow for GitHub/CV.
  - **Edge case:** If there are no offers, the app shows an actionable empty state tied to config/scan status.

## 3. Glossary

- **Career Ops** — The upstream open-source CLI/workspace engine that manages CV/profile/job-search files, scans job portals, and generates tracking/report artifacts.
- **Career Ops Workspace** — The local directory containing Career Ops user-layer files and system scripts.
- **Wrapper Backend** — The Node.js/TypeScript API service named `career-ops-wrapper` that mediates between Android and the Career Ops Workspace.
- **Android App** — The Kotlin/Jetpack Compose mobile client in this repository.
- **CV Markdown** — The user's CV content stored as Markdown for Career Ops consumption.
- **Profile Config** — Career Ops user profile information used to tailor search and evaluation behavior.
- **Portal Config** — Career Ops search/portal configuration, including filters, tracked companies, and search queries.
- **Scan Run** — One execution of the Career Ops scanner initiated through the Wrapper Backend.
- **Offer** — A job opportunity parsed from Career Ops pipeline/tracker files and normalized for mobile display.
- **Report** — A Career Ops-generated Markdown evaluation or summary artifact.
- **Artifact** — A generated output file such as a PDF resume or related Career Ops output.
- **Projection Cache** — Android-local cached data derived from the Wrapper Backend, not the source of truth.
- **Real First** — The MVP strategy requiring real Career Ops integration and business logic before UI-only or mock-only completeness.
- **MVP Profile Fields** — The normalized Profile Config fields the Android App must support in v1.
- **MVP Portal Fields** — The normalized Portal Config fields the Android App must support in v1.
- **Offer DTO** — The normalized JSON shape the Wrapper Backend returns for Offers.

## 4. Features

### 4.0 MVP Data Contracts

**Description:** This section defines the product-level data contracts required to make the PRD phase-safe for architecture and story creation. Exact wire schemas belong in architecture, but these fields are required for MVP behavior and acceptance.

#### MVP Profile Fields

The Android App must let the user read and edit these MVP Profile Fields:

| Field | Required | Notes |
| --- | --- | --- |
| `targetRoles` | Yes | List of desired role titles or role families. |
| `seniorityLevel` | Yes | Desired level, such as junior, mid, senior, lead, or equivalent free text. |
| `preferredLocations` | Yes | List of locations or regions the user is willing to consider. |
| `remotePreference` | Yes | Remote, hybrid, onsite, or flexible. |
| `salaryMin` | No | Minimum desired compensation. |
| `salaryMax` | No | Maximum desired compensation, optional. |
| `salaryCurrency` | No | Currency code for salary range. Required when either salary bound is set. |
| `workAuthorizationNote` | No | Free-text work authorization, visa, or relocation note. |
| `mustHaveSkills` | No | List of skills the user wants matching roles to require or value. |
| `niceToHaveSkills` | No | List of secondary skills. |
| `excludedKeywords` | No | Roles, industries, or keywords to avoid. |
| `positioningSummary` | No | Short professional positioning used for job-search context. |

The Wrapper Backend must preserve unknown upstream Profile Config fields when possible, but Android is only required to render and edit the MVP Profile Fields.

#### MVP Portal Fields

The Android App must let the user read and edit these MVP Portal Fields:

| Field | Required | Notes |
| --- | --- | --- |
| `titlePositiveKeywords` | No | Title keywords that should be included. |
| `titleNegativeKeywords` | No | Title keywords that should be excluded. |
| `locationAllowList` | No | Location keywords that are allowed. |
| `locationBlockList` | No | Location keywords that are blocked. |
| `salaryMin` | No | Minimum compensation filter. |
| `salaryMax` | No | Maximum compensation filter; empty means no upper bound. |
| `salaryCurrency` | No | Currency code for salary filters. |
| `trackedCompanies[].name` | Yes when tracked company exists | Company display name. |
| `trackedCompanies[].careersUrl` | Yes when tracked company exists | Careers or jobs URL. |
| `trackedCompanies[].provider` | No | Provider override when known. |
| `trackedCompanies[].enabled` | Yes when tracked company exists | Whether the company participates in scans. |
| `searchQueries[].label` | Yes when search query exists | User-facing label. |
| `searchQueries[].query` | Yes when search query exists | Search text. |
| `searchQueries[].enabled` | Yes when search query exists | Whether the query participates in scans. |

The Wrapper Backend must preserve unknown upstream Portal Config fields when possible, but Android is only required to render and edit the MVP Portal Fields.

#### Offer DTO

The Wrapper Backend must return these minimum Offer DTO fields for each Offer:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Stable backend-generated identifier. |
| `company` | Yes | Company name. |
| `title` | Yes | Role title. |
| `url` | No | Job URL when known. |
| `location` | No | Location text when known. |
| `source` | Yes | Source file/provider/search origin when known by the backend. |
| `status` | Yes | Normalized status such as new, tracked, applied, rejected, unknown. |
| `firstSeenAt` | No | Timestamp or date first observed. |
| `lastSeenAt` | No | Timestamp or date last observed. |
| `scanRunId` | No | Scan Run provenance when known. |

The Wrapper Backend may return these optional fields:

- `salaryMin`, `salaryMax`, `salaryCurrency`
- `workMode` such as remote, hybrid, onsite, or unknown
- `score`
- `reportId`
- `artifactIds`
- `rawSource`
- `notes`

Missing optional fields must not block listing or opening an Offer.

#### MVP Connection Modes

The MVP must support both development and real-device demo modes:

- Android emulator to local Wrapper Backend through host loopback configuration.
- Physical Android device to Wrapper Backend over trusted LAN using a Local Pairing Token.

Remote hosted access is not required for MVP.

### 4.1 Wrapper Connection and Workspace Health

**Description:** The Android App connects to a Wrapper Backend and verifies that the backend is bound to a valid Career Ops Workspace. This feature realizes UJ-1 and prevents the app from showing fake readiness when the real engine is not usable.

**Functional Requirements:**

#### FR-1: Use configured wrapper endpoint

The Android App can use the Wrapper Backend endpoint supplied by app flavor BuildConfig or local build/session configuration. Realizes UJ-1.

**Consequences (testable):**
- The app does not require user-entered URL or token fields in the setup UI for the local MVP.
- The app can retry health checks after wrapper availability or build/session configuration changes.
- Invalid configured endpoint format prevents connection attempts and shows a clear validation message.

#### FR-2: Display wrapper health

The Android App can request and display Wrapper Backend health, including service availability and Career Ops Workspace readiness. Realizes UJ-1.

**Consequences (testable):**
- Healthy state requires both wrapper availability and workspace validation.
- Failed checks identify the failing area: endpoint unreachable, workspace missing, required files missing, command unavailable, or script failure.
- The app blocks scan actions when health is not ready.

#### FR-3: Surface setup guidance without replacing setup

The Android App can show concise setup guidance when the Wrapper Backend or Career Ops Workspace is not ready.

**Consequences (testable):**
- Guidance does not claim to install Career Ops automatically in MVP.
- Guidance links failure states to corrective actions.
- Setup state is visible before CV/profile/scan workflows.

### 4.2 CV and Profile Management

**Description:** The user manages CV Markdown and Profile Config from mobile. The Wrapper Backend remains responsible for safe reads/writes to Career Ops files. This feature realizes UJ-2.

**Functional Requirements:**

#### FR-4: Read CV Markdown

The Android App can load the current CV Markdown from the Wrapper Backend.

**Consequences (testable):**
- If CV Markdown exists, the app displays its content or summary status.
- If CV Markdown is missing, the app shows a not-ready state.
- Backend errors preserve the last known Projection Cache without marking it as authoritative.

#### FR-5: Save CV Markdown

The user can upload or edit CV Markdown and save it through the Wrapper Backend.

**Consequences (testable):**
- The Wrapper Backend writes only inside the configured Career Ops Workspace.
- The Wrapper Backend can read back the saved CV Markdown after write.
- The Wrapper Backend rejects empty CV Markdown and CV Markdown larger than 512 KB.
- The previous CV file is backed up or otherwise recoverable before overwrite.

#### FR-6: Read Profile Config

The Android App can load normalized Profile Config fields from the Wrapper Backend.

**Consequences (testable):**
- The app displays MVP Profile Fields in editable form.
- Unknown or unsupported upstream fields are not silently discarded by read operations.
- Missing Profile Config produces an actionable not-ready state.

#### FR-7: Save Profile Config

The user can edit and save MVP Profile Config fields through the Wrapper Backend.

**Consequences (testable):**
- Save validates required MVP Profile Fields before writing.
- Save preserves unknown fields when possible.
- Save failure leaves the previous known-good Profile Config intact.
- Read-after-write returns the updated values.

### 4.3 Portal Config and Search Criteria

**Description:** The user configures job search criteria that Career Ops uses for scanning. This feature realizes UJ-3.

**Functional Requirements:**

#### FR-8: Read Portal Config

The Android App can load normalized Portal Config from the Wrapper Backend.

**Consequences (testable):**
- The app displays MVP Portal Fields when available.
- Invalid upstream YAML is reported as a backend validation error.
- The app does not attempt to repair invalid config silently.

#### FR-9: Save Portal Config

The user can edit and save MVP Portal Config fields through the Wrapper Backend.

**Consequences (testable):**
- Save validates config structure before writing.
- Save preserves unknown config fields when possible.
- Save backs up the previous portal config before overwrite.
- Read-after-write returns the updated config.
- Save rejects Portal Config payloads larger than 128 KB.

#### FR-10: Validate scan readiness

The app can show whether the current CV, Profile Config, and Portal Config are sufficient to start a Scan Run.

**Consequences (testable):**
- Missing CV, missing Profile Config, missing Portal Config, or unhealthy workspace each produce distinct readiness messages.
- Scan action is disabled when readiness fails.
- Readiness is recalculated after saves and health checks.

### 4.4 Real Scan Execution

**Description:** The user starts real Career Ops scans from mobile. The Wrapper Backend executes allowlisted Career Ops commands and exposes run status. This feature realizes UJ-3 and is the main Real First proof point.

**Functional Requirements:**

#### FR-11: Start Scan Run

The user can start a Scan Run from the Android App when readiness checks pass.

**Consequences (testable):**
- Starting a Scan Run creates a run record with a stable run ID.
- The Wrapper Backend executes the real Career Ops scanner, not a mock scanner.
- The app receives initial status without waiting for scan completion.
- The Wrapper Backend rejects a second Scan Run while one is already running and returns a user-visible conflict state.

#### FR-12: Poll Scan Run status

The Android App can poll and display Scan Run status.

**Consequences (testable):**
- Status includes at least pending/running/succeeded/failed.
- Status includes timestamps and human-readable failure details when available.
- App state survives screen rotation or ViewModel recreation while polling.

#### FR-13: Preserve Scan Run auditability

The Wrapper Backend records enough information to debug a Scan Run after completion.

**Consequences (testable):**
- Run record includes command type, start/end time, exit status, and sanitized logs or summary.
- Sensitive CV/profile content is not written to logs.
- Failed runs do not corrupt Career Ops user-layer files.

### 4.5 Offer Review

**Description:** The Android App displays offers parsed from Career Ops files after real scan execution. This feature realizes UJ-4.

**Functional Requirements:**

#### FR-14: List Offers

The Android App can display Offers from the Wrapper Backend.

**Consequences (testable):**
- Offer list is based on parsed Career Ops pipeline/tracker files.
- Each Offer includes the minimum Offer DTO fields defined in §4.0.
- Optional Offer DTO fields render when present and do not block rendering when absent.
- Empty state distinguishes "no scan yet" from "scan completed with zero offers."

#### FR-15: View Offer detail

The user can open an Offer detail view.

**Consequences (testable):**
- Detail view shows all minimum Offer DTO fields and any optional fields returned by the backend for the Offer.
- Missing optional fields render gracefully.
- External URLs open through normal Android external intent behavior. [ASSUMPTION: MVP does not embed a web browser.]

#### FR-16: Cache latest Offers

The Android App stores a Projection Cache of latest Offers for responsive UI.

**Consequences (testable):**
- Cached Offers are visible when wrapper is temporarily unreachable.
- Cached state is labeled or behaviorally distinct from freshly synced state.
- Wrapper data remains source of truth after refresh.

### 4.6 Reports and Artifacts

**Description:** The user can view available Career Ops Reports and Artifacts when they exist, without requiring full evaluation/PDF generation in the first scan-focused flow.

**Functional Requirements:**

#### FR-17: List Reports and Artifacts

The Android App can display available Reports and Artifacts returned by the Wrapper Backend.

**Consequences (testable):**
- Reports and Artifacts are linked to Offers when the relationship is known.
- Missing reports/artifacts do not block scan or offer review.
- The app distinguishes "not generated" from "backend error."

#### FR-18: Open Report or Artifact

The user can open a Report or download/open an Artifact.

**Consequences (testable):**
- Markdown Reports are rendered in-app through a simple readable Markdown view.
- Artifact downloads are served only from within the Career Ops Workspace.
- Missing files return a clear error.

### 4.7 Neo-Brutalist Android Experience

**Description:** The Android App keeps the existing source-code style: bold borders, hard shadows, saturated accents, compact card surfaces, expressive buttons, and MVI-style interactions. UI comes after real integration, but MVP must still feel like a coherent mobile app.

**Functional Requirements:**

#### FR-19: Preserve current visual language

The Android App uses the existing neo-brutalist components and color palette as the basis for new Career Ops screens.

**Consequences (testable):**
- Primary screens use bold borders, hard shadows, and existing accent colors.
- UI does not introduce an unrelated design system.
- Empty/error/loading states are styled consistently.
- Setup, CV/Profile, Portal Config, Scan Status, Offer List, Offer Detail, and Reports/Artifacts screens all use the same visual language.

#### FR-20: Provide MVP navigation surfaces

The Android App provides navigable surfaces for setup, CV/profile, portal config, scans, offers, and reports/artifacts.

**Consequences (testable):**
- User can complete UJ-1 through UJ-4 without leaving the app except for external job URLs.
- Navigation state is understandable on a mobile screen.
- Critical actions are not hidden behind terminal-only instructions.
- MVP navigation exposes these surfaces: setup, CV/Profile, Portal Config, Scan Status, Offer List, Offer Detail, and Reports/Artifacts.

## 5. Non-Goals (Explicit)

- No public SaaS product in MVP.
- No multi-user account system.
- No username/password login.
- No direct Android port of Career Ops.
- No mock-only MVP completion.
- No fully automated job application submission.
- No in-app Playwright/browser automation.
- No phone-only Career Ops runtime.
- No remote hosted backend as the default v1 deployment.
- No production/public backend security hardening in MVP; Firebase App Check, production HTTPS policy, server-held production secrets, user auth, and optional certificate/public-key pinning are deferred.
- No full AI evaluation orchestration unless real scriptable behavior is verified during implementation.
- No PDF/DOCX CV conversion in MVP; CV input is Markdown-only.

## 6. MVP Scope

### 6.1 In Scope

- Android app connects to a real Wrapper Backend.
- Wrapper Backend validates a real Career Ops Workspace.
- User can manage CV Markdown.
- User can manage MVP Profile Config fields.
- User can manage MVP Portal Config/search criteria.
- User can start a real Career Ops scan.
- User can see Scan Run status and failures.
- User can view Offers parsed from Career Ops files.
- User can view Reports/Artifacts when present.
- Android app uses existing neo-brutalist UI style.
- Integration correctness and file safety are first-class acceptance criteria.

### 6.2 Out of Scope for MVP

- Mock-first demo mode as the primary implementation path, because the user explicitly wants real integration and business logic first.
- Full remote/private backend deployment, deferred until local wrapper proves stable.
- Docker packaging, deferred unless Playwright/browser setup blocks local development.
- Automated application submission, deferred because it requires deeper Career Ops workflow confidence and higher risk controls.
- Advanced offer scoring/evaluation flows, deferred until scanner/config/offer loop is stable.
- PDF generation from mobile, deferred unless existing Career Ops artifact generation is already reliable through the wrapper.

## 7. Cross-Cutting NFRs

- **NFR-1: Real Integration First.** MVP completion requires the Wrapper Backend to call real Career Ops scripts and read/write real Career Ops files for the core scan flow.
- **NFR-2: File Safety.** Any write to CV, Profile Config, or Portal Config must validate input and preserve or back up the previous known-good file.
- **NFR-3: Workspace Boundary.** Wrapper Backend must never read or serve files outside the configured Career Ops Workspace.
- **NFR-4: Command Allowlist.** Wrapper Backend must never expose arbitrary shell command execution.
- **NFR-5: Privacy.** Logs and run records must not expose full CV/profile content or secrets.
- **NFR-6: Local-First Security.** Wrapper Backend binds to localhost by default; LAN/private access requires a Local Pairing Token. This token is not user authentication, not a public API key, and not account login.
- **NFR-7: Mobile Responsiveness.** Android App must not block UI while scans run; long-running work is represented by run status.
- **NFR-8: Recoverability.** Failed saves and failed scans must leave the system in a debuggable, recoverable state.
- **NFR-9: Portfolio Readability.** The repository should make architecture and trade-offs understandable to future reviewers through README/docs after implementation. [ASSUMPTION: README refresh is a downstream implementation/story item, not part of this PRD artifact.]

## 8. System Boundaries and API Capability Groups

The Wrapper Backend public surface should be small and product-oriented. Exact endpoint schemas belong in architecture, but the MVP must support these capability groups:

- Health and workspace readiness.
- CV read/write.
- Profile Config read/write.
- Portal Config read/write.
- Scan Run create/status.
- Offer list/detail.
- Report/Artifact list/open.

The Android App must treat the Wrapper Backend as the only integration surface. It must not mutate Career Ops files directly.

The expected endpoint families are:

- `GET /health`
- `GET /cv`, `PUT /cv`
- `GET /profile`, `PUT /profile`
- `GET /portals`, `PUT /portals`
- `POST /scan-runs`, `GET /scan-runs/{id}`
- `GET /offers`, `GET /offers/{id}`
- `GET /reports`, `GET /reports/{id}`
- `GET /artifacts/{id}`

## 9. Constraints and Guardrails

### 9.1 Safety and Privacy

- CV/profile/search data is sensitive personal data.
- No account login is required for local MVP.
- Physical phone LAN access requires a token despite "no authentication" at the product-account level.
- Android emulator development access must support host loopback configuration.
- Sensitive file contents must not be copied into logs, crash messages, or screenshots intentionally.

### 9.2 Cost

- MVP should avoid mandatory AI provider calls.
- The first scan flow should use Career Ops scanner behavior before adding evaluation-heavy flows.

### 9.3 Technical Boundaries

- Career Ops Workspace remains source of truth.
- Android Room cache is a Projection Cache only.
- Wrapper Backend is Node.js/TypeScript to stay aligned with Career Ops runtime. Implementation details live in addendum.

## 10. Success Metrics

**Primary**

- **SM-1:** End-to-end real scan success — from connected app, user can save config, start a real Scan Run, and see Offers in the app. Target: succeeds on a fixture or personal Career Ops Workspace before UI polish is considered complete. Validates FR-1 through FR-16.
- **SM-2:** File safety confidence — CV/Profile/Portal write tests prove invalid saves do not corrupt previous known-good files. Target: automated tests cover happy path, invalid input, and write failure for each file type. Validates FR-5, FR-7, FR-9, NFR-2.
- **SM-3:** Portfolio demo flow — user can demonstrate UJ-1 through UJ-4 from the app. Target: one continuous demo path suitable for GitHub README/screenshots. Validates FR-1 through FR-20.

**Secondary**

- **SM-4:** Mobile architecture clarity — Career Ops feature follows repository/use-case/ViewModel/Compose separation. Target: code review can identify clear data/domain/presentation boundaries. Validates FR-16, FR-19, FR-20.
- **SM-5:** Debuggability — failed scans expose useful status and sanitized logs. Target: at least one forced scan failure produces actionable UI/backend diagnostics. Validates FR-12, FR-13.

**Counter-metrics (do not optimize)**

- **SM-C1:** UI screen count — do not optimize for many screens before real integration works. Counterbalances SM-3.
- **SM-C2:** Mock demo completeness — do not count mocked sample data as MVP completion. Counterbalances SM-1.
- **SM-C3:** Backend cleverness — do not optimize for a general multi-user platform before the personal local workflow is stable. Counterbalances SM-4.

## 11. Open Questions

### 11.1 Phase-Blocking Open Questions

None. MVP Profile Fields, MVP Portal Fields, Offer DTO fields, connection modes, report rendering, CV format, and Scan Run concurrency are resolved in this PRD for architecture handoff.

### 11.2 Deferred / Non-Blocking Open Questions

1. What is the final public product name for GitHub/CV presentation: Career Ops Mobile, Career Arena, or another name?
2. Should v2 support PDF/DOCX CV upload and conversion to CV Markdown?
3. Should v2 add Docker packaging for the Wrapper Backend?
4. Should v2 add advanced offer scoring, AI evaluation, or PDF artifact generation from mobile?
5. Should v2 support remote private deployment beyond trusted LAN?

## 12. Assumptions Index

- §4.5 FR-15 — MVP opens external job URLs through Android external intent, not an embedded browser.
- §7 NFR-9 — README refresh is a downstream implementation/story item, not part of this PRD artifact.
