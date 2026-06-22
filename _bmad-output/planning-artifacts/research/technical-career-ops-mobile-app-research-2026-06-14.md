---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: []
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: 'Career Ops mobile app feasibility'
research_goals: 'Research feasibility for turning career-ops open-source CLI into a personal Android mobile app. Goals: upload CV, edit profile config, search/scan job offers from user config, no authentication, keep current Android app UI style. Evaluate direct Android port, local backend wrapper, and remote private backend wrapper using official Career Ops docs and repo behavior. Output recommended MVP architecture, risks, and next PRD inputs.'
user_name: 'Hy'
date: '2026-06-14'
web_research_enabled: true
source_verification: true
---

# Research Report: technical

**Date:** 2026-06-14
**Author:** Hy
**Research Type:** technical

---

## Research Overview

This research evaluates whether the open-source Career Ops CLI/workspace system can become a personal Android mobile app with CV upload, editable profile configuration, job-offer scanning from user-provided config, no user-account authentication, and the current app's neo-brutalist UI style. The research used official Career Ops docs and repository behavior, Android architecture guidance, Playwright runtime/deployment documentation, OWASP API security guidance, and the existing Android codebase in this workspace.

The central finding is that a direct Android port is technically possible but not a good MVP path. Career Ops is a local-first Node.js/JavaScript workspace engine with file contracts, npm scripts, AI CLI flows, and Playwright/browser dependencies. The recommended MVP is an Android Kotlin/Compose app that talks to a Node.js/TypeScript `career-ops-wrapper` REST backend, which in turn owns the Career Ops workspace and runs allowlisted Career Ops scripts. See the Research Synthesis section for the executive recommendation, risk register, and PRD inputs.

---

## Technical Research Scope Confirmation

**Research Topic:** Career Ops mobile app feasibility
**Research Goals:** Research feasibility for turning career-ops open-source CLI into a personal Android mobile app. Goals: upload CV, edit profile config, search/scan job offers from user config, no authentication, keep current Android app UI style. Evaluate direct Android port, local backend wrapper, and remote private backend wrapper using official Career Ops docs and repo behavior. Output recommended MVP architecture, risks, and next PRD inputs.

**Technical Research Scope:**

- Architecture Analysis - design patterns, frameworks, system architecture
- Implementation Approaches - development methodologies, coding patterns
- Technology Stack - languages, frameworks, tools, platforms
- Integration Patterns - APIs, protocols, interoperability
- Performance Considerations - scalability, optimization, patterns

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-06-14

## Technology Stack Analysis

### Programming Languages

Career Ops is primarily a JavaScript/Node.js system with some Go for its terminal dashboard. The upstream repository reports JavaScript as the majority language and includes scripts such as `scan.mjs`, `generate-pdf.mjs`, `doctor.mjs`, `tracker.mjs`, and `gemini-eval.mjs`; its `package.json` lists the package as private, version `1.10.0`, and describes it as an AI-powered job search pipeline for AI coding CLIs. The current Android codebase is Kotlin/Jetpack Compose, so the core technical decision is not "which UI language?" but "where does the existing Node/AI/browser automation runtime live?"

_Popular Languages:_ Kotlin for the Android app; JavaScript/Node.js for Career Ops orchestration; Go only if reusing or replacing the terminal dashboard layer.

_Emerging Languages:_ None required for the MVP. TypeScript could improve a future wrapper API, but the upstream system is already JavaScript `.mjs`.

_Language Evolution:_ Career Ops is moving in an engine-first, CLI-agnostic direction, but its public repo behavior still depends on workspace files and Node scripts. Android should treat Career Ops as an external engine/service first, not as Kotlin-native business logic.

_Performance Characteristics:_ Kotlin/Compose is suitable for local mobile UI state, document upload, and result browsing. Node.js is the natural runtime for reusing Career Ops scanning/PDF/evaluation helpers. A direct Kotlin port would require reimplementing provider loading, YAML config handling, pipeline file mutation, browser verification, PDF generation, and AI-command orchestration.

_Sources:_ https://github.com/santifer/career-ops, https://raw.githubusercontent.com/santifer/career-ops/main/package.json, local Android files `/Users/dthuy/Workspace/task-arena/app/build.gradle.kts` and `/Users/dthuy/Workspace/task-arena/gradle/libs.versions.toml`

### Development Frameworks and Libraries

Career Ops depends on Node libraries for configuration, AI evaluation, and browser automation. The repo `package.json` lists `@google/generative-ai`, `dotenv`, `js-yaml`, and `playwright`. Its scanner is a plugin-style provider layer: `scan.mjs` loads provider modules from `providers/*.mjs`, resolves a provider from each `tracked_companies` entry, applies title/location/salary filters, deduplicates against local pipeline/application files, and optionally verifies URLs with Playwright. Official Career Ops docs also state that PDFs are generated by headless Chromium via Playwright.

The existing Android app already has a healthy client stack: Jetpack Compose Material 3, Room, Retrofit, OkHttp, Moshi, Kotlin coroutines, lifecycle ViewModel Compose, and a simple manual dependency container. This is aligned with Google's recommended architecture where repositories expose data, centralize data changes, abstract data sources, and may contain business logic.

_Major Frameworks:_ Android Jetpack Compose for UI; Room for local storage; Retrofit/OkHttp/Moshi for API integration; Node.js scripts for Career Ops; Playwright/Chromium for PDF and URL liveness; Gemini API script support exists upstream.

_Micro-frameworks:_ The Career Ops scanner's provider modules are the most important lightweight extension point. For mobile MVP, expose this provider scan through a wrapper instead of embedding the provider logic directly in Android.

_Evolution Trends:_ Career Ops supports multiple AI coding CLIs and also documents a standalone Gemini API script path. That makes a non-interactive wrapper more feasible than a pure slash-command integration, but the full workflow still expects local files and AI agent context.

_Ecosystem Maturity:_ Android libraries in the current app are mature and common. Career Ops' engine is active and moving quickly, so wrapper boundaries should stay thin to avoid frequent porting work.

_Sources:_ https://career-ops.org/docs, https://career-ops.org/docs/introduction/guides/scan-job-portals, https://raw.githubusercontent.com/santifer/career-ops/main/package.json, https://raw.githubusercontent.com/santifer/career-ops/main/scan.mjs, https://developer.android.com/topic/architecture/data-layer

### Database and Storage Technologies

Career Ops stores state as local workspace files: CV markdown, YAML profile/portal config, Markdown pipeline/application tracker files, TSV scan history, reports, and output PDFs. The docs describe onboarding as writing config files from conversational answers and describe scan output being written to `data/pipeline.md`. The scanner code confirms `portals.yml`, `data/scan-history.tsv`, `data/pipeline.md`, and `data/applications.md` as key runtime files.

The Android app currently uses Room, which is a good local cache for mobile views such as profiles, scan runs, offers, scores, status, and generated artifact metadata. For MVP, Room should not become the source of truth for the Career Ops workspace. Instead, the wrapper service should own the canonical Career Ops files, while Android stores a synchronized, queryable projection.

_Relational Databases:_ Room/SQLite is appropriate on Android for cached offers, scan run status, local draft profile fields, and UI filters.

_NoSQL Databases:_ Not needed for MVP.

_In-Memory Databases:_ Not needed. Simple in-process state plus Room is enough.

_Data Warehousing:_ Not relevant for a personal app MVP.

_Sources:_ https://career-ops.org/docs, https://career-ops.org/docs/introduction/guides/scan-job-portals, https://raw.githubusercontent.com/santifer/career-ops/main/scan.mjs, local Android file `/Users/dthuy/Workspace/task-arena/app/src/main/java/com/example/data/database/AppDatabase.kt`

### Development Tools and Platforms

The current Android platform is Gradle + Android Gradle Plugin + Kotlin + Compose. The project already includes Roborazzi, Robolectric, JUnit, AndroidX test, and Compose UI tests, which are useful for keeping the existing neo-brutalist UI style stable during the pivot from task arena to career operations.

Career Ops setup requires Node and an AI coding assistant according to the Quick Start docs. Manual setup uses `git clone`, `npm install`, and `npx playwright install chromium`. The Career Ops repo also exposes utility scripts through `npm run` commands, including `doctor`, `scan`, `pdf`, `tracker`, and `gemini:eval`.

_IDE and Editors:_ Android Studio for the app; a terminal/Node environment for the wrapper.

_Version Control:_ Git is required by Career Ops setup and already present in this repo.

_Build Systems:_ Gradle for Android; npm scripts for Career Ops engine/wrapper.

_Testing Frameworks:_ Existing Android unit/UI screenshot tests can cover mobile UI. Wrapper tests should exercise Career Ops workspace fixtures, provider scan dry-runs, and parser behavior using Node test tooling.

_Sources:_ https://career-ops.org/docs, https://raw.githubusercontent.com/santifer/career-ops/main/package.json, local Android files `/Users/dthuy/Workspace/task-arena/app/build.gradle.kts` and `/Users/dthuy/Workspace/task-arena/gradle/libs.versions.toml`

### Cloud Infrastructure and Deployment

Career Ops is explicitly local-first and not a hosted service. Official docs emphasize no account, no telemetry, and local ownership of CV/profile/application history; data only leaves the machine if the user sends it to an AI provider or pushes it elsewhere. This strongly favors a local/private wrapper over a public hosted backend for the user's stated no-auth personal MVP.

Playwright's official system requirements target desktop/server operating systems with Node.js and browser binaries, not Android as a bundled in-app runtime. That makes "run Career Ops fully inside Android" the riskiest option, especially for browser verification and PDF generation. A local machine service or private remote backend can satisfy Node/Playwright requirements cleanly.

_Major Cloud Providers:_ Not required for MVP. A small private VPS is possible later, but it raises CV privacy and no-auth risk.

_Container Technologies:_ Docker can package the wrapper plus Career Ops workspace later; not required for first MVP if running on a trusted local machine.

_Serverless Platforms:_ Poor fit because Career Ops relies on a persistent local workspace, browser automation, and file artifacts.

_CDN and Edge Computing:_ Not relevant.

_Sources:_ https://career-ops.org/docs/introduction/what-is-career-ops, https://playwright.dev/docs/intro, https://playwright.dev/docs/library

### Technology Adoption Trends

For this project, the meaningful trend is not general mobile technology adoption; it is Career Ops becoming CLI-agnostic and engine-first while still retaining a file/workspace-based contract. The repo README states the system works with multiple AI coding CLIs, supports standalone Gemini evaluation, and uses a local source of truth. That creates an integration path: keep Android as the polished mobile control surface, and wrap the Career Ops engine behind stable API endpoints or command adapters.

_Migration Patterns:_ Start with local/private wrapper around upstream Career Ops; avoid direct Android port until the domain contract stabilizes.

_Emerging Technologies:_ AI coding CLI command systems and agent skills are central to Career Ops, but for a mobile app they should be hidden behind explicit backend operations: upload CV, update profile, scan portals, list offers, evaluate selected offer, generate PDF.

_Legacy Technology:_ Terminal-only UX is the main friction to remove. The file-based engine is not a weakness for MVP; it is a stable integration surface if wrapped carefully.

_Community Trends:_ A companion UI direction already exists in the ecosystem, but the official project remains local-first and repo-driven. Treat upstream as the engine, not just inspiration.

_Sources:_ https://github.com/santifer/career-ops, https://career-ops.org/docs/introduction/what-is-career-ops, https://career-ops.org/docs

## Integration Patterns Analysis

### API Design Patterns

The best integration pattern for the MVP is a small REST-style wrapper around Career Ops' existing command and file contract. Android should not know how to mutate `cv.md`, `modes/_profile.md`, `portals.yml`, `data/pipeline.md`, `reports/`, or `output/` directly. It should call coarse-grained operations that map to user intent: upload CV, read/update profile, read/update portal config, run scan, list offers, evaluate selected offers, fetch report, fetch generated PDF.

Microsoft's REST API guidance recommends resource-oriented APIs with HTTP methods that match action semantics, request/response bodies in standard formats, and clear status codes. For this app, that means reads like `GET /profile`, updates like `PUT /profile`, and long-running commands like `POST /scan-runs` returning a scan-run resource rather than blocking the mobile app until every portal finishes.

_RESTful APIs:_ Recommended. Use JSON over HTTPS for mobile-to-wrapper traffic. Keep endpoints resource-oriented, but allow command resources for long-running Career Ops actions such as scan/evaluate/generate-pdf.

_GraphQL APIs:_ Not recommended for MVP. The domain is small, the client is single-purpose, and REST is simpler to debug.

_RPC and gRPC:_ Not recommended for MVP. gRPC adds tooling friction on Android and does not fit the file/artifact-heavy nature of Career Ops as well as REST with download endpoints.

_Webhook Patterns:_ Optional later. For MVP, Android can poll scan-run/evaluation-run status. Webhooks make more sense only if the wrapper becomes a multi-client service.

_Source:_ https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design, https://developer.android.com/topic/architecture/data-layer

### Communication Protocols

Use HTTP/HTTPS between Android and the wrapper. For a local wrapper running on the user's machine or LAN, plain HTTP may be acceptable only during development; production-style private use should prefer HTTPS or an OS-level trusted tunnel because CV/profile data is sensitive. Android already has Retrofit and OkHttp dependencies, so API calls fit the existing codebase with minimal stack churn.

Career Ops itself communicates through command execution and local files. The wrapper should run Node scripts via child processes for deterministic utility commands like `npm run scan`, parse their outputs and resulting files, and expose normalized JSON to Android. For AI CLI commands such as `/career-ops pipeline`, integration is less deterministic because the "AI reasoning" happens inside an agentic CLI. MVP should prefer scriptable flows first: upload/config, script scan, file parsing, report listing, and optional standalone Gemini evaluation where suitable.

_HTTP/HTTPS Protocols:_ Recommended Android-to-wrapper protocol.

_WebSocket Protocols:_ Useful later for streaming scan/evaluation logs, but polling `GET /runs/{id}` is simpler for MVP.

_Message Queue Protocols:_ Not needed unless the wrapper becomes a shared multi-user backend.

_gRPC and Protocol Buffers:_ Not needed; the payloads are small and human-debuggable JSON is better for early iteration.

_Source:_ https://developer.android.com/topic/architecture/data-layer, https://career-ops.org/docs/introduction/guides/scan-job-portals, https://raw.githubusercontent.com/santifer/career-ops/main/package.json

### Data Formats and Standards

Career Ops' real integration surface is file-based. Official docs and `DATA_CONTRACT.md` identify user-owned files such as `cv.md`, `config/profile.yml`, `modes/_profile.md`, `portals.yml`, `data/pipeline.md`, `data/applications.md`, `data/scan-history.tsv`, `reports/*`, and `output/*`. The wrapper should translate these into mobile-friendly JSON DTOs, while preserving the upstream files as source of truth.

For writes, use domain-specific DTOs rather than raw file editors wherever possible. For example, Android's profile editor can send structured fields that the wrapper renders into YAML/Markdown. CV upload can preserve the original text as `cv.md`; future versions may accept PDF/DOCX and convert to Markdown, but that is a separate ingestion feature. Portal config should expose title filters, location filters, salary filters, tracked companies, and search queries as structured JSON, then write valid `portals.yml`.

_JSON and XML:_ JSON is recommended for API payloads. XML is unnecessary.

_Protobuf and MessagePack:_ Not needed for MVP.

_CSV and Flat Files:_ TSV/Markdown/YAML remain important internally because Career Ops uses them. The wrapper should parse and validate them.

_Custom Data Formats:_ Reports are Markdown, generated resumes are PDF, scan history is TSV, and config is YAML/Markdown. Treat these as durable domain formats rather than implementation leftovers.

_Source:_ https://raw.githubusercontent.com/santifer/career-ops/main/DATA_CONTRACT.md, https://career-ops.org/docs/introduction/guides/scan-job-portals, https://career-ops.org/docs/introduction/guides/batch-evaluate-offers

### System Interoperability Approaches

The strongest MVP pattern is a point-to-point Android client plus one private wrapper service bound to one Career Ops workspace. This preserves Career Ops' local-first philosophy and avoids solving multi-user identity, tenancy, and synchronization prematurely. The wrapper becomes the anti-corruption layer between Android domain models and upstream Career Ops file/script behavior.

The wrapper should enforce a strict workspace boundary. It should only read/write paths inside the configured Career Ops workspace, only expose user-layer artifacts needed by the app, and never let Android send arbitrary shell commands. Scripts like `scan.mjs` already support flags such as `--dry-run`, `--company`, and `--verify`, and env vars such as `CAREER_OPS_PORTALS`; `merge-tracker.mjs` also has env path overrides and lock logic. These are useful seams for integration tests and wrapper execution.

_Point-to-Point Integration:_ Recommended for MVP: Android client to one wrapper API.

_API Gateway Patterns:_ Not needed unless exposing multiple services or multiple users.

_Service Mesh:_ Not relevant.

_Enterprise Service Bus:_ Not relevant.

_Source:_ https://raw.githubusercontent.com/santifer/career-ops/main/scan.mjs, https://raw.githubusercontent.com/santifer/career-ops/main/merge-tracker.mjs, https://career-ops.org/docs/introduction/what-is-career-ops

### Microservices Integration Patterns

Avoid microservices for the first version. The app has one user, one workspace, and one engine. A modular monolith wrapper is simpler: API layer, workspace adapter, Career Ops command runner, file parser/serializer, job queue, and artifact server. Use a small internal queue so long-running scan/evaluation operations do not block HTTP requests and so the app can poll status.

If the wrapper later moves to a remote private backend, keep the same API contract but add deployment controls: per-user workspace path, storage encryption, API key, request limits, and backups. Do not expose Career Ops internals as many tiny services before the mobile product shape is proven.

_API Gateway Pattern:_ Not required for MVP.

_Service Discovery:_ Not required.

_Circuit Breaker Pattern:_ Useful conceptually for calls to job portals and AI providers; implement simple timeouts/retries first.

_Saga Pattern:_ Not needed as a formal distributed transaction. Use resumable run records for scan/evaluation steps.

_Source:_ https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design, https://career-ops.org/docs/introduction/guides/batch-evaluate-offers

### Event-Driven Integration

The MVP should use an internal job/run model rather than full event-driven infrastructure. When the user taps "Scan", Android calls `POST /scan-runs`; the wrapper creates a run record, starts the Career Ops scan command, streams or stores logs, parses resulting files, and exposes current status via `GET /scan-runs/{id}`. Android stores the latest projection in Room for fast UI rendering.

For future versions, server-sent events or WebSockets can stream progress, but they should not be necessary for first release. Mobile UX can show a "scan running" state and refresh every few seconds.

_Publish-Subscribe Patterns:_ Internal event emitter only if convenient; no external broker.

_Event Sourcing:_ Not needed. Career Ops already has durable history files such as `data/scan-history.tsv`.

_Message Broker Patterns:_ Not needed for one-user MVP.

_CQRS Patterns:_ A light version is useful: commands mutate Career Ops workspace; queries read normalized JSON projections. Avoid naming this as CQRS in the product unless it actually becomes complex.

_Source:_ https://career-ops.org/docs/introduction/guides/scan-job-portals, https://raw.githubusercontent.com/santifer/career-ops/main/scan.mjs

### Integration Security Patterns

The user's "no authentication" requirement is feasible only if scoped carefully. For a local-only wrapper bound to `127.0.0.1`, no login may be acceptable. For LAN or remote private backend, "no user accounts" should not mean "no protection." At minimum, use a random local pairing token/API key, bind to localhost by default, avoid public network exposure, and redact logs. OWASP API Security Top 10 highlights authorization failures and unrestricted access to sensitive business flows as major API risks; CV/profile/job application data is private enough to deserve guardrails even for a personal tool.

On Android, store the wrapper endpoint and pairing token in app-private storage; if using a remote backend later, prefer HTTPS and API-key rotation. The wrapper must validate file upload size/type, reject path traversal, avoid arbitrary command parameters, and limit command execution to known Career Ops actions.

_OAuth 2.0 and JWT:_ Overkill for personal local MVP.

_API Key Management:_ Recommended if wrapper is reachable beyond localhost.

_Mutual TLS:_ Optional for advanced private deployments.

_Data Encryption:_ Recommended for transport beyond localhost and for remote storage. Local-only MVP can rely on OS disk protections initially, but CV files should be treated as sensitive.

_Source:_ https://owasp.org/API-Security/editions/2023/en/0x11-t10/, https://career-ops.org/docs/introduction/what-is-career-ops, https://raw.githubusercontent.com/santifer/career-ops/main/DATA_CONTRACT.md

### Recommended MVP API Boundary

The first wrapper API should be intentionally small:

- `GET /health` - confirm wrapper and Career Ops workspace are ready.
- `GET /profile` / `PUT /profile` - read/write normalized profile fields backed by `config/profile.yml` and `modes/_profile.md`.
- `PUT /cv` / `GET /cv` - upload/read Markdown CV backed by `cv.md`.
- `GET /portals` / `PUT /portals` - edit title filters, location filters, tracked companies, and search queries backed by `portals.yml`.
- `POST /scan-runs` - run `npm run scan`, with options for dry-run, company, verify.
- `GET /scan-runs/{id}` - status, counts, logs, new offer ids.
- `GET /offers` - normalized view of `data/pipeline.md` and `data/applications.md`.
- `GET /reports` / `GET /reports/{id}` - list and render Markdown reports.
- `GET /artifacts/{id}` - download generated PDFs from `output/`.

This boundary lets Android keep its existing MVI/Repository pattern: a `CareerOpsRepository` talks to Retrofit and Room, exposes state flows to ViewModels, and maps wrapper DTOs into UI models styled with the current neo-brutalist components.

## Architectural Patterns and Design

### System Architecture Patterns

Three architectures were evaluated:

1. **Direct Android port** - Reimplement Career Ops behavior inside Kotlin/Android.
2. **Local backend wrapper** - Android talks to a private service running on the user's machine or local network, and that service wraps an upstream Career Ops workspace.
3. **Remote private backend wrapper** - Android talks to a private hosted service that owns the Career Ops workspace and runtime.

The recommended MVP architecture is **local backend wrapper first**, with a design that can later be deployed as a remote private backend. This preserves Career Ops' local-first philosophy, avoids premature authentication/multi-tenancy work, and keeps the complex Node/Playwright/file-contract runtime outside the Android app. Career Ops official docs describe it as local, open-source, no-account software where CV/profile/application history stay on the user's machine unless the user sends them elsewhere. Its repo data contract separates user-owned data from system files, so the wrapper should preserve that model instead of flattening everything into Android storage.

The existing Android app already follows a layered shape: domain models/use cases, data repository, Room database, Retrofit/OkHttp dependencies, and Compose MVI-like state/effects. Android's official architecture guidance recommends layered architecture, unidirectional data flow, state holders, coroutines/flows, and repositories. This means the mobile app can evolve cleanly into a Career Ops client without abandoning its current structure.

_Source:_ https://developer.android.com/topic/architecture, https://developer.android.com/develop/ui/compose/architecture, https://career-ops.org/docs/introduction/what-is-career-ops, https://github.com/santifer/career-ops/blob/main/DATA_CONTRACT.md

### Architecture Option Assessment

**Option A: Direct Android Port**

- **Fit:** Low for MVP.
- **Pros:** Offline on the phone, no service setup, simpler user story once complete.
- **Cons:** Requires porting Node scripts, provider plugin loading, YAML/Markdown/TSV file semantics, PDF generation, browser verification, AI-agent flow, update behavior, and data contract rules into Kotlin. Playwright's official docs focus on Node/browser dependencies and CI/Docker-style environments, which is a poor match for a packaged Android app.
- **Use later if:** Career Ops exposes a stable engine API independent of CLI/browser tooling, or only a tiny non-browser subset is needed.

**Option B: Local Backend Wrapper**

- **Fit:** Highest for MVP.
- **Pros:** Reuses upstream Career Ops as-is; keeps CV/profile local; supports Node/Playwright properly; lets Android stay focused on UI, upload/edit, scan controls, and results browsing; no accounts required.
- **Cons:** User must run a companion service; Android must discover/configure endpoint; mobile-only usage outside home network is limited unless tunneled.
- **Use now for:** Personal MVP, proof of product flow, and architecture validation.

**Option C: Remote Private Backend Wrapper**

- **Fit:** Medium for MVP, strong for convenience if privacy is handled.
- **Pros:** Works anywhere from phone; backend runtime can be controlled; easier to run browser automation and scheduled scans.
- **Cons:** "No auth" becomes unsafe if exposed publicly; CV/profile storage becomes a hosting/security responsibility; must handle secrets, backups, access control, and potential AI provider credentials.
- **Use later if:** Local wrapper UX is too cumbersome and the user accepts private backend security setup.

_Source:_ https://playwright.dev/docs/docker, https://playwright.dev/docs/ci, https://raw.githubusercontent.com/santifer/career-ops/main/package.json, https://career-ops.org/docs/introduction/guides/scan-job-portals

### Design Principles and Best Practices

The mobile app should follow the current Android structure rather than introduce a different architecture style. Create a new Career Ops feature slice with:

- `CareerOpsRepository` in the data/domain boundary.
- Retrofit service for wrapper API calls.
- Room entities for cached projections: profile summary, portal config snapshot, scan runs, offers, reports, artifacts.
- Use cases for upload CV, save profile, save portals, start scan, refresh offers, open report, download artifact.
- Compose screens and MVI state/effects mirroring the current `ArenaUiState`, `ArenaUiIntent`, and `ArenaUiEffect` pattern.

On the wrapper side, use a modular monolith:

- API layer: REST endpoints.
- Workspace adapter: read/write `cv.md`, profile files, `portals.yml`, pipeline/tracker/report/output files.
- Command runner: safe allowlist for Career Ops scripts (`scan`, `pdf`, `tracker`, `gemini:eval` where appropriate).
- Parser/serializer: Markdown/YAML/TSV to JSON DTOs and back.
- Run manager: tracks long-running scans/evaluations and logs.
- Security boundary: path validation, upload validation, endpoint binding, optional pairing token.

This preserves separation of concerns: Android owns presentation and local cache; wrapper owns Career Ops orchestration; Career Ops owns system logic and user-layer artifacts.

_Source:_ https://developer.android.com/topic/architecture/data-layer, https://developer.android.com/topic/architecture/ui-layer, https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design

### Scalability and Performance Patterns

The app is personal and single-user, so horizontal scalability is not a first-order concern. Performance should focus on responsiveness and resumability:

- Long-running operations become run resources (`scan-runs`, later `evaluation-runs`) rather than blocking requests.
- Android polls run status and caches projections in Room.
- Wrapper executes Career Ops commands with timeouts, logs, and cancellation where possible.
- Portal scans can start with zero-token script scanning because the official docs say `npm run scan` reads `portals.yml`, hits known ATS APIs, and writes new jobs to `data/pipeline.md`.
- Browser/AI-heavy paths should be added after the basic scan/projection loop works.

Career Ops batch evaluation can process many offers with parallel workers, but that should not be an MVP requirement. For first release, mobile can expose scan and result browsing, then add evaluate/PDF/apply flows incrementally.

_Source:_ https://career-ops.org/docs/introduction/guides/scan-job-portals, https://career-ops.org/docs/introduction/guides/batch-evaluate-offers, https://developer.android.com/topic/architecture

### Integration and Communication Patterns

Use REST/JSON for Android-to-wrapper communication and retain Career Ops files as canonical storage. This creates a clean anti-corruption layer:

```text
Android Compose UI
  -> ViewModel / MVI intents
  -> Use cases
  -> CareerOpsRepository
  -> Retrofit API + Room cache
  -> Local/private wrapper REST API
  -> Career Ops workspace adapter
  -> Career Ops scripts and user-layer files
```

The wrapper should expose normalized offer/report/profile models rather than leaking Markdown parsing to Android. For the MVP, do not require a live WebSocket. Polling is enough. Add server-sent events or WebSockets only when progress feedback becomes a product need.

_Source:_ https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design, https://raw.githubusercontent.com/santifer/career-ops/main/scan.mjs, https://github.com/santifer/career-ops/blob/main/DATA_CONTRACT.md

### Security Architecture Patterns

The safe interpretation of "no authentication" is: no user accounts, no login screen, no SaaS identity. It should not mean an unprotected public API. The wrapper should bind to localhost by default; if Android needs to reach it from a phone, use LAN-only access with a generated pairing token or a private tunnel. OWASP API Security guidance identifies authorization failures and unrestricted access to sensitive flows as major API risks; CVs, job targets, reports, and generated answers are sensitive enough to protect even for a personal tool.

Required MVP guardrails:

- No arbitrary shell command endpoint.
- All file reads/writes constrained to the configured Career Ops workspace.
- Upload size/type validation.
- Logs redact obvious secrets and personal tokens.
- Optional API key/pairing token if reachable beyond `127.0.0.1`.
- Clear local/private deployment warning in setup.

_Source:_ https://owasp.org/API-Security/editions/2023/en/0x11-t10/, https://career-ops.org/docs/introduction/what-is-career-ops

### Data Architecture Patterns

Use a dual-store model:

- **Career Ops workspace = source of truth** for user data and generated artifacts.
- **Android Room = local projection/cache** for fast mobile UI, offline viewing of latest synced data, and MVI state hydration.

This avoids dangerous divergence. Android can edit profile and portal config through the wrapper, but the wrapper is responsible for rendering valid Career Ops files. When commands complete, wrapper re-parses files and returns updated projections. If conflict handling is needed later, Career Ops user-layer files win unless the mobile edit is the latest explicit user action.

Recommended initial mobile entities:

- `ProfileSnapshotEntity`
- `PortalConfigSnapshotEntity`
- `ScanRunEntity`
- `OfferEntity`
- `ReportEntity`
- `ArtifactEntity`

Recommended canonical workspace files:

- `cv.md`
- `config/profile.yml`
- `modes/_profile.md`
- `portals.yml`
- `data/pipeline.md`
- `data/applications.md`
- `data/scan-history.tsv`
- `reports/*`
- `output/*`

_Source:_ https://github.com/santifer/career-ops/blob/main/DATA_CONTRACT.md, https://developer.android.com/topic/architecture/data-layer

### Deployment and Operations Architecture

For MVP, run the wrapper on the developer/user machine where Career Ops is cloned and configured:

```text
Phone on same trusted network
  -> http(s)://local-wrapper-host:port
  -> career-ops workspace on local disk
  -> Node scripts + Playwright dependencies
```

Setup should include:

1. Clone/install Career Ops.
2. Run `npm install`.
3. Install Playwright browser dependencies where needed.
4. Start wrapper with a configured workspace path.
5. Pair Android app to wrapper endpoint/token.

Docker is a good later packaging option because Playwright officially documents Docker/CI patterns that include Node, browser binaries, and system dependencies. For first MVP, a plain Node wrapper is faster to build and debug; for reproducibility, add Docker once the API contract stabilizes.

_Source:_ https://career-ops.org/docs, https://playwright.dev/docs/docker, https://playwright.dev/docs/ci

### Recommended MVP Architecture

**Recommendation:** Build a **local backend wrapper MVP**.

**Why:** It maximizes reuse of Career Ops, respects local-first privacy, avoids Android-side Playwright/Node complexity, and fits the current app architecture. It also keeps a migration path open: the same wrapper can later run on a private VPS or Docker host if mobile-anywhere convenience becomes more important than local-only privacy.

**MVP scope:**

- Android Career Ops dashboard in existing neo-brutalist style.
- CV upload/read as Markdown first.
- Profile editor for the fields required by Career Ops.
- Portal config editor for title filters, location/salary filters, tracked companies, and search queries.
- Scan run creation and status polling.
- Offer list from `data/pipeline.md`/`data/applications.md`.
- Report list/view when reports exist.
- No public auth; local pairing token if wrapper is not localhost-only.

**Defer:**

- Full direct Android port.
- Public SaaS backend.
- Browser-driven apply automation.
- Full batch evaluation orchestration from mobile.
- Mobile PDF generation inside Android.

## Implementation Approaches and Technology Adoption

### Technology Adoption Strategies

Use an incremental adoption strategy, not a big-bang rewrite. Martin Fowler's Strangler Fig pattern and Microsoft's Azure Architecture Center both frame modernization as creating a new façade around an existing system, then moving capabilities over in phases while the original system keeps working. That maps cleanly here: Career Ops remains the working engine; the wrapper becomes the façade; Android gradually replaces the CLI UX for selected workflows.

Adoption path:

1. **Keep upstream Career Ops intact.** Clone/install Career Ops separately and validate the CLI works.
2. **Create a wrapper service beside it.** Do not fork/rewrite Career Ops until specific changes are proven necessary.
3. **Expose only stable user workflows.** CV/profile/portal config, scan runs, offers, reports.
4. **Build Android as client/projection.** Use Retrofit and Room to sync wrapper data into the current Compose/MVI architecture.
5. **Promote only proven flows.** Add evaluation/PDF/apply automation after scan and profile flows are reliable.

This reduces risk because the user can still fall back to Career Ops CLI during early app development.

_Source:_ https://martinfowler.com/bliki/StranglerFigApplication.html, https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig, https://career-ops.org/docs

### Development Workflows and Tooling

Recommended repository structure:

```text
task-arena/
  app/                         # Existing Android app
  career-ops-wrapper/          # New Node service
    src/
      api/
      workspace/
      commands/
      parsers/
      runs/
      security/
    fixtures/
    tests/
```

Wrapper tech stack should stay boring:

- Node.js service, preferably TypeScript for DTO safety.
- Fastify or Express for REST endpoints.
- `js-yaml` for `portals.yml` / profile YAML.
- Markdown parser for pipeline/report extraction.
- Child process runner for allowlisted `npm run scan`, `npm run pdf`, `npm run tracker`, and future commands.
- Zod or similar runtime validation for request bodies.

Android development should reuse existing dependencies and patterns:

- Retrofit service interface for wrapper API.
- Moshi DTOs.
- Room entities for cached projections.
- Coroutines/Flow for async state.
- MVI-style UI state/intents/effects matching `ArenaMvi.kt`.
- Neo-brutalist components from `NeoBrutalist.kt` and current theme colors.

The current Android app has a global `RetrofitClient` for Gemini; for Career Ops, avoid another singleton tied to one base URL. Add a configurable `CareerOpsApiService` constructed from a stored wrapper endpoint, because local/private wrapper addresses will vary.

_Source:_ https://developer.android.com/topic/architecture, https://developer.android.com/topic/architecture/data-layer, https://raw.githubusercontent.com/santifer/career-ops/main/package.json

### Testing and Quality Assurance

Testing should cover the wrapper contract more heavily than UI polish at first, because the riskiest behavior is file/command integration.

Wrapper tests:

- Unit tests for parsing `data/pipeline.md`, `data/applications.md`, reports, scan history TSV, and `portals.yml`.
- Golden fixture tests for writing profile/portal config without losing unknown fields.
- Command runner tests using dry-run fixtures and mocked child processes.
- Security tests for path traversal, oversized upload, unknown command rejection, invalid YAML, and workspace boundary enforcement.
- Integration smoke test against a real Career Ops fixture workspace.

Android tests:

- Repository tests with fake API service and in-memory Room.
- ViewModel tests for intents: upload CV, save profile, start scan, poll status, load offers.
- Compose screenshot tests/R史oborazzi for keeping the current style.
- Minimal E2E later: mock wrapper server plus app flow.

Android official testing guidance emphasizes organizing tests by scope and using test doubles. This project already includes Robolectric, Roborazzi, Compose UI test, JUnit, and coroutines test dependencies, so the mobile side has enough test tooling for MVP.

_Source:_ https://developer.android.com/training/testing/fundamentals, https://android-developers.googleblog.com/2022/02/write-better-tests-with-new-testing.html, local `/Users/dthuy/Workspace/task-arena/app/build.gradle.kts`

### Deployment and Operations Practices

MVP deployment should start as local developer mode:

1. User installs Career Ops and validates `npm run doctor` / quick start.
2. User starts `career-ops-wrapper` with `CAREER_OPS_WORKSPACE=/path/to/career-ops`.
3. Wrapper binds to `127.0.0.1` by default.
4. If using a physical phone, wrapper can bind to LAN with an explicit pairing token.
5. Android app stores endpoint/token in local app storage and syncs.

Later, package wrapper in Docker. Playwright's official Docker image includes browser system dependencies, and Playwright CI docs recommend using Docker or installing browser dependencies via CLI. That is a strong argument for containerizing the wrapper once it needs browser verification/PDF flows reliably across machines.

Operational basics:

- Health endpoint checks Node version, Career Ops path, required files, npm scripts, and Playwright readiness.
- Structured logs with redaction.
- Run history for scans/evaluations.
- Timeout/cancel for long-running commands.
- Clear error mapping back to Android UI.

_Source:_ https://playwright.dev/docs/docker, https://playwright.dev/docs/ci, https://career-ops.org/docs

### Team Organization and Skills

For a solo/personal MVP, split work by hats rather than people:

- **Mobile engineer:** Kotlin, Compose, Room, Retrofit, MVI state.
- **Wrapper engineer:** Node/TypeScript, REST API, child processes, filesystem safety.
- **Career Ops integrator:** Understands Career Ops config/data contract and scripts.
- **Security reviewer:** Checks no-auth assumptions, workspace boundaries, token handling, and upload safety.

Skill gap to close first: Career Ops behavior. Before writing a lot of UI, run Career Ops manually with a small CV/profile/portal setup and observe which files change after scan/evaluate/PDF flows. That observation should inform wrapper DTOs and PRD acceptance criteria.

_Source:_ https://career-ops.org/docs/introduction/guides/scan-job-portals, https://github.com/santifer/career-ops/blob/main/DATA_CONTRACT.md

### Cost Optimization and Resource Management

Local wrapper has the lowest direct infrastructure cost. It also limits exposure of private data. Costs to watch:

- AI provider calls if using Gemini/OpenAI/Claude-based evaluation.
- Time spent maintaining a fork if upstream Career Ops changes.
- Browser automation CPU/memory when Playwright verification/PDF generation runs.
- Mobile UX friction if local service setup is too manual.

Cost controls:

- Start with zero-token `npm run scan` flow.
- Make AI evaluation optional.
- Use dry-run mode during testing.
- Cache parsed offer/report projections.
- Keep wrapper thin so upstream upgrades remain easy.

_Source:_ https://career-ops.org/docs/introduction/guides/scan-job-portals, https://raw.githubusercontent.com/santifer/career-ops/main/scan.mjs, https://raw.githubusercontent.com/santifer/career-ops/main/package.json

### Risk Assessment and Mitigation

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Career Ops internals change | Wrapper breaks | Keep wrapper at user-layer file/script boundary; pin tested Career Ops version |
| Direct Android port becomes too large | MVP stalls | Do not port; wrap first |
| No-auth remote service exposes CV data | Privacy/security incident | Localhost default; token for LAN/remote; never public unauthenticated |
| Markdown/YAML parsing loses data | User config corruption | Round-trip tests, backups before writes, preserve unknown fields |
| Long scans block app | Poor UX | Run resources, polling, timeouts, cancellation |
| Playwright/browser deps fail on user machine | Broken PDF/verify flows | Defer browser-heavy flows; add health checks; Docker later |
| Career Ops CLI AI flows are not deterministic | Hard to automate | Start with scriptable scan/config flows; add AI/evaluate endpoints after observing CLI behavior |

OWASP API Security Top 10 explicitly calls out broken authorization, broken authentication, unrestricted resource consumption, unrestricted access to sensitive business flows, and security misconfiguration. Even for a personal tool, these map to wrapper risks: sensitive CV data, command execution, scan automation, and remote exposure.

_Source:_ https://owasp.org/www-project-api-security/, https://owasp.org/API-Security/editions/2023/en/0x11-t10/, https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/

## Technical Research Recommendations

### Implementation Roadmap

**Phase 0: Manual Career Ops discovery**

- Install and run Career Ops manually.
- Create a tiny sample `cv.md`, profile, and `portals.yml`.
- Run scan, inspect changed files, confirm source-of-truth files.
- Decide exact MVP fields for profile and portals.

**Phase 1: Wrapper skeleton**

- Create `career-ops-wrapper`.
- Add health endpoint and workspace validation.
- Add safe file adapter with path boundary checks and backups.
- Add DTOs for CV/profile/portals.

**Phase 2: Scan loop**

- Add `POST /scan-runs`.
- Execute `npm run scan` with controlled flags.
- Parse pipeline/applications/scan history.
- Return scan status and offer projections.

**Phase 3: Android pivot**

- Add Career Ops data/domain/presentation feature slice.
- Configure wrapper endpoint.
- Build dashboard: profile status, CV status, last scan, offer count.
- Build CV/profile/portal screens with existing neo-brutalist style.
- Build offers list and scan action.

**Phase 4: Reports/artifacts**

- List Markdown reports.
- Render report details in app.
- Download/open generated PDFs from wrapper.

**Phase 5: Advanced flows**

- Add evaluation orchestration.
- Add PDF generation.
- Consider Docker packaging or private remote backend.

### Technology Stack Recommendations

- **Android:** Keep Kotlin, Jetpack Compose, Room, Retrofit, OkHttp, Moshi, Coroutines, MVI-style ViewModel state.
- **Wrapper:** Node.js + TypeScript, Fastify/Express, YAML/Markdown parsers, child process runner, file backups, Zod validation, test runner.
- **Runtime:** Local machine first; Docker later for Playwright/browser stability.
- **Storage:** Career Ops workspace as canonical; Android Room as projection cache.
- **Security:** Localhost default, pairing token for LAN/private remote, no arbitrary commands.

### Skill Development Requirements

- Learn Career Ops data contract and file lifecycle.
- Learn wrapper-safe child process execution.
- Learn YAML/Markdown round-trip safety.
- Learn Android Repository + Room cache pattern for remote sync.
- Learn basic API threat modeling for local/private services.

### Success Metrics and KPIs

MVP success should be measured by concrete user flows:

- User can connect app to wrapper successfully.
- User can upload or edit CV markdown.
- User can edit core profile fields without corrupting Career Ops files.
- User can edit portal filters/companies/search queries.
- User can start a scan and see status.
- New offers appear in mobile within one refresh cycle after scan completion.
- User can open offer details and related report/artifact links when present.
- No Career Ops user-layer file is corrupted during normal mobile edits.

## Research Synthesis: Career Ops Mobile App Feasibility

## Executive Summary

Career Ops can be turned into a personal Android mobile app, but the app should not try to embed or rewrite Career Ops directly in Kotlin for the first version. The upstream tool is designed as a local-first AI job-search command center: it runs in an AI coding CLI/workspace, stores user data in local files, uses Node.js scripts for scanner/tracker/PDF/evaluation utilities, and relies on Playwright/Chromium for browser-backed tasks such as PDF generation and URL verification. The current Android app, by contrast, is already well suited to be a polished mobile control surface: Kotlin, Jetpack Compose, Room, Retrofit/OkHttp/Moshi, coroutines, and MVI-style state.

The recommended architecture is **Android app -> Node.js/TypeScript `career-ops-wrapper` backend -> Career Ops workspace/engine**. The wrapper should expose a small REST API for CV upload, profile editing, portal config editing, scan execution, offer listing, report/artifact access, and later evaluation/PDF flows. Career Ops files remain canonical; Android stores a Room projection/cache for UI responsiveness.

This architecture satisfies the user's MVP goals while minimizing risk. It keeps the current UI/UX style, avoids authentication/accounts for local use, preserves Career Ops' local-first privacy model, and avoids porting Node/Playwright/AI-agent behavior into Android. The only caveat is that "no authentication" must be interpreted carefully: no user accounts is fine for local/private use, but if the wrapper is reachable from LAN or remote hosting, it needs at least a pairing token/API key because CV/profile data is sensitive.

**Key Technical Findings**

- Career Ops is a Node/JavaScript-first local workspace engine, not a library ready to embed in Android.
- The current Android app is a good shell for a mobile client because it already uses Compose, Room, Retrofit, coroutines, and MVI-style flows.
- The best MVP integration boundary is REST/JSON between Android and a Node.js/TypeScript wrapper.
- Career Ops user-layer files should remain source of truth: `cv.md`, profile files, `portals.yml`, `data/pipeline.md`, `data/applications.md`, `reports/*`, and `output/*`.
- Direct Android port has the highest risk and least reuse.
- Local wrapper has the best privacy/reuse trade-off.
- Remote private backend is feasible later but requires stronger security and operational discipline.

**Technical Recommendations**

- Build `career-ops-wrapper` in Node.js + TypeScript, preferably Fastify + Zod + `js-yaml` + Markdown parsing + allowlisted child-process execution.
- Keep Career Ops installed as an upstream engine/workspace; do not fork or rewrite it for MVP.
- Use Android Retrofit for wrapper calls and Room as a projection cache.
- Start with scriptable flows: health, CV, profile, portal config, scan runs, offers.
- Defer evaluation orchestration, PDF generation, and apply automation until the scan/profile loop works.
- Treat no-auth as local/private only; add pairing token/API key when the wrapper is reachable beyond localhost.

## Table of Contents

1. Technical Research Introduction and Methodology
2. Technical Landscape and Architecture Analysis
3. Implementation Approaches and Best Practices
4. Technology Stack Evolution and Current Trends
5. Integration and Interoperability Patterns
6. Performance and Scalability Analysis
7. Security and Compliance Considerations
8. Strategic Technical Recommendations
9. Implementation Roadmap and Risk Assessment
10. Future Technical Outlook and Innovation Opportunities
11. Technical Research Methodology and Source Verification
12. PRD Inputs

## 1. Technical Research Introduction and Methodology

This research asks a practical architecture question: how do we turn a powerful local CLI/workspace tool into a mobile app without losing the parts that make it valuable? Career Ops already solves a meaningful workflow: evaluating jobs against a CV/profile, scanning job sources, generating artifacts, and tracking applications locally. The Android app should make those capabilities easier to use from a phone, not recreate the entire engine on day one.

The research combined live web/source verification with local codebase inspection. Primary sources included the official Career Ops docs and GitHub repository, Android official architecture documentation, Playwright official Docker/CI/runtime documentation, OWASP API Security guidance, and the local Android project files.

_Technical Importance:_ The integration boundary decides whether the mobile app is a small, shippable client or a large rewrite of a moving open-source tool.

_Business Impact:_ A wrapper architecture gives the user a usable personal mobile workflow faster, while preserving the option to later package or host the backend.

_Sources:_ https://career-ops.org/docs, https://github.com/santifer/career-ops, https://developer.android.com/topic/architecture, https://playwright.dev/docs/docker, https://owasp.org/www-project-api-security/

## 2. Technical Landscape and Architecture Analysis

Career Ops' public repo describes an AI-powered job-search pipeline for AI coding CLIs. Its `package.json` exposes Node scripts including `doctor`, `scan`, `pdf`, `tracker`, `gemini:eval`, `merge`, and update utilities. Its scanner uses provider plugins, reads `portals.yml`, writes scan history and pipeline files, and can optionally verify URLs using Playwright. The data contract separates user-layer files from system-layer files, which is exactly the boundary a wrapper should preserve.

The Android app is already layered: UI components, arena screen MVI state/intents/effects, ViewModel, use cases, repository, Room database, Retrofit/OkHttp/Moshi, and coroutines. Android official guidance recommends layered architecture and unidirectional data flow, so the existing structure is a good base for a Career Ops mobile client.

**Architecture Decision:** Build a local backend wrapper first.

| Option | Feasibility | MVP Fit | Main Risk |
| --- | --- | --- | --- |
| Direct Android port | Possible but expensive | Low | Rewriting Node/Playwright/file-contract behavior |
| Local Node wrapper | High | High | Companion service setup |
| Remote private wrapper | High with security work | Medium | CV/profile privacy and access control |

_Sources:_ https://raw.githubusercontent.com/santifer/career-ops/main/package.json, https://raw.githubusercontent.com/santifer/career-ops/main/scan.mjs, https://github.com/santifer/career-ops/blob/main/DATA_CONTRACT.md, https://developer.android.com/develop/ui/compose/architecture

## 3. Implementation Approaches and Best Practices

Implementation should follow an incremental/strangler-style modernization pattern: keep the existing tool functional, introduce a façade around it, and move only selected user workflows into the new interface. Here, the façade is `career-ops-wrapper`.

Recommended wrapper stack:

- Node.js + TypeScript
- Fastify for REST API
- Zod for runtime validation
- `js-yaml` for YAML config
- Markdown parsing for reports/pipeline
- Node `child_process` for allowlisted Career Ops commands
- Vitest for wrapper tests
- Docker later for reproducible Playwright/browser runtime

Recommended Android approach:

- Add `CareerOpsApiService` using configurable Retrofit base URL.
- Add `CareerOpsRepository` that coordinates API and Room cache.
- Add domain use cases for CV/profile/portals/scan/offers/reports.
- Add Compose screens with existing neo-brutalist components and MVI-style state.
- Keep Career Ops workspace as source of truth; Room only caches projections.

_Sources:_ https://martinfowler.com/bliki/StranglerFigApplication.html, https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig, https://developer.android.com/topic/architecture/data-layer

## 4. Technology Stack Evolution and Current Trends

The stack should stay aligned with the two systems already in play: Android Kotlin/Compose for mobile and Node.js for Career Ops. Choosing Node.js/TypeScript for the wrapper reduces runtime mismatch and makes it easier to call existing `.mjs` scripts, reuse YAML/Markdown/Playwright-related tooling, and eventually containerize the backend.

No database should replace Career Ops files in MVP. The source of truth remains the Career Ops workspace, while Android Room stores a local projection for fast viewing and offline-ish last-known state.

_Sources:_ https://raw.githubusercontent.com/santifer/career-ops/main/package.json, https://playwright.dev/docs/ci, https://playwright.dev/docs/docker

## 5. Integration and Interoperability Patterns

The wrapper should expose a small REST API:

- `GET /health`
- `GET /profile`, `PUT /profile`
- `GET /cv`, `PUT /cv`
- `GET /portals`, `PUT /portals`
- `POST /scan-runs`
- `GET /scan-runs/{id}`
- `GET /offers`
- `GET /reports`, `GET /reports/{id}`
- `GET /artifacts/{id}`

The wrapper should translate file/script behavior into stable JSON DTOs. Android should never send arbitrary shell commands or raw filesystem paths. Long-running scan/evaluation jobs should become run resources that Android can poll.

_Sources:_ https://learn.microsoft.com/en-us/azure/architecture/best-practices/api-design, https://raw.githubusercontent.com/santifer/career-ops/main/scan.mjs

## 6. Performance and Scalability Analysis

This is a personal app MVP, so scale is about responsiveness, not high traffic. The major performance risks are long-running scans, Playwright browser startup, and AI provider calls. The MVP should start with zero-token scanner flows and defer browser/AI-heavy operations.

Recommended performance model:

- API requests return quickly.
- Scan/evaluation commands run asynchronously.
- Android polls run status.
- Wrapper parses files after commands complete.
- Room caches latest offer/report projections.

_Sources:_ https://career-ops.org/docs/introduction/guides/scan-job-portals, https://playwright.dev/docs/ci

## 7. Security and Compliance Considerations

The user requirement says no authentication. For architecture, this should mean no user accounts and no login screen. It should not mean an unprotected API if the wrapper is reachable over a network.

Minimum security expectations:

- Bind wrapper to localhost by default.
- Require pairing token/API key for LAN/private remote access.
- Constrain all file operations to the configured Career Ops workspace.
- Use an allowlist for commands.
- Validate upload size/type.
- Back up config files before writes.
- Redact secrets and sensitive CV content from logs.

_Sources:_ https://owasp.org/www-project-api-security/, https://owasp.org/API-Security/editions/2023/en/0x11-t10/, https://career-ops.org/docs/introduction/what-is-career-ops

## 8. Strategic Technical Recommendations

Primary recommendation: **Build a local Node.js/TypeScript `career-ops-wrapper` backend and a Career Ops Android client.**

Decision framework:

- If the goal is fastest useful MVP: local wrapper.
- If the goal is mobile-anywhere convenience: private remote wrapper later.
- If the goal is pure phone-only operation: direct port, but only after MVP proves value.

The wrapper should be thin, conservative, and test-heavy around file parsing/writing. The Android app should focus on ergonomic mobile workflows: setup status, CV/profile editing, scan control, offer browsing, and report/artifact viewing.

## 9. Implementation Roadmap and Risk Assessment

**Phase 0: Manual Career Ops Discovery**

- Install Career Ops.
- Create sample CV/profile/portals config.
- Run scan manually.
- Observe exactly which files change.

**Phase 1: Wrapper Skeleton**

- Add `career-ops-wrapper/`.
- Implement health/workspace validation.
- Add path boundary checks and file backup helpers.

**Phase 2: Config and Scan API**

- Implement CV/profile/portals endpoints.
- Implement `POST /scan-runs`.
- Parse offers from Career Ops files.

**Phase 3: Android Client**

- Add Retrofit service and repository.
- Add Room projection entities.
- Build dashboard, CV/profile/portal screens, scan action, and offers list using current style.

**Phase 4: Reports and Artifacts**

- List and render Markdown reports.
- Download/open generated PDFs.

**Phase 5: Advanced Career Ops Flows**

- Add evaluation orchestration.
- Add PDF generation.
- Package wrapper with Docker.
- Consider private remote deployment.

Top risks:

- Career Ops file formats change: mitigate with version pinning and fixture tests.
- Wrapper corrupts user files: mitigate with backups and round-trip tests.
- No-auth endpoint exposes CV data: mitigate with localhost default and pairing token.
- Playwright setup fails: defer browser-heavy features and use Docker later.

## 10. Future Technical Outlook and Innovation Opportunities

Near-term opportunity is not replacing Career Ops, but making it approachable on mobile. Once the wrapper proves stable, higher-value features become possible:

- Scheduled scans from wrapper.
- Push notifications for new high-fit roles.
- Mobile review queue for offers.
- One-tap evaluation request.
- Report/PDF preview.
- Private remote deployment for always-available usage.

The architecture keeps these options open because Android talks to a stable API, not Career Ops internals.

## 11. Technical Research Methodology and Source Verification

Primary sources:

- Career Ops official docs: https://career-ops.org/docs
- Career Ops repo: https://github.com/santifer/career-ops
- Career Ops package/scripts: https://raw.githubusercontent.com/santifer/career-ops/main/package.json
- Career Ops scanner: https://raw.githubusercontent.com/santifer/career-ops/main/scan.mjs
- Career Ops data contract: https://github.com/santifer/career-ops/blob/main/DATA_CONTRACT.md
- Android architecture docs: https://developer.android.com/topic/architecture
- Compose UDF docs: https://developer.android.com/develop/ui/compose/architecture
- Playwright Docker/CI docs: https://playwright.dev/docs/docker and https://playwright.dev/docs/ci
- OWASP API Security: https://owasp.org/www-project-api-security/
- Strangler pattern: https://martinfowler.com/bliki/StranglerFigApplication.html

Confidence level: **High** for the MVP architecture recommendation. The key constraints are directly visible in official docs, upstream scripts/data contract, and the local Android app structure. Remaining uncertainty is implementation detail: exact Career Ops profile fields and report/pipeline parsing should be finalized by running a manual sample workspace before PRD lock.

## 12. PRD Inputs

**Product Name:** Career Ops Mobile, working title.

**Target User:** Personal/solo user who wants Career Ops workflows on mobile without learning/using the CLI for everyday scanning and review.

**MVP Goal:** Connect Android app to a local Node.js wrapper and support CV/profile/portal setup plus job scan/offers review.

**Core MVP Features:**

- Connect to wrapper endpoint.
- View wrapper/Career Ops health.
- Upload or edit CV Markdown.
- Edit profile config.
- Edit portal/search config.
- Start a scan.
- View scan status.
- View offers from Career Ops pipeline/tracker.
- View reports/artifacts when available.

**Non-Goals for MVP:**

- Public SaaS.
- Multi-user accounts.
- Direct Android port of Career Ops.
- Fully automated application submission.
- In-app Playwright/PDF generation.
- Full AI evaluation workflow from mobile unless scriptable after discovery.

**Architecture Requirement:** Android Kotlin/Compose client + Node.js/TypeScript Fastify wrapper + existing Career Ops workspace.

**Security Requirement:** No user accounts for MVP, but wrapper must be localhost-only by default and require pairing token/API key for LAN or remote access.

**Acceptance Criteria:**

- App can connect to wrapper and show health status.
- User can save CV/profile/portal config without corrupting Career Ops files.
- User can start scan and see scan progress/status.
- New offers appear in app after scan completion.
- App keeps current neo-brutalist visual language.
- Wrapper rejects arbitrary command execution and path traversal.

---

## Technical Research Conclusion

The project is feasible and should proceed, but only with a wrapper-based architecture. Career Ops is valuable precisely because it already handles a complex local AI/job-search workflow; the mobile app should make that workflow easier to operate, not absorb its entire runtime. A Node.js/TypeScript wrapper gives the cleanest bridge between Android and Career Ops, aligns with upstream technology, and gives the user a credible path from personal local MVP to optional private deployment later.

**Technical Research Completion Date:** 2026-06-14
**Research Period:** current comprehensive technical analysis
**Source Verification:** All major technical claims cited with current official/project sources
**Technical Confidence Level:** High

<!-- Content will be appended sequentially through research workflow steps -->
