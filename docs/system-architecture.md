# System Architecture

## Overview

JobFlow is local-first. The Android app is the user interface. The wrapper API
is the only integration surface for Career Ops workspace files and scripts.

```mermaid
flowchart LR
  Android["Android app\nCompose + Hilt + ViewModel"]
  ApiClient["Retrofit / OkHttp\n/api/v1 DTOs"]
  Wrapper["career-ops-wrapper\nFastify + Zod"]
  Workspace["Career Ops Workspace\ncv.md, profile config, portals.yml, scripts"]

  Android --> ApiClient
  ApiClient --> Wrapper
  Wrapper --> Workspace
```

## Component Responsibilities

| Component | Owns |
| --- | --- |
| Android presentation | Screens, UI state, intents, effects, user feedback |
| Android domain | App models, repository contracts, use cases |
| Android data | Retrofit, DTO mapping, error mapping, repository implementations (Room cache planned) |
| Wrapper routes | HTTP endpoints, request parsing, response schema checks |
| Wrapper services | Use-case behavior for health, CV, profile, portals, readiness, scan runs, AI evaluations, offer/report/artifact projection |
| Wrapper parsers | Pure parsing of Career Ops tracker, pipeline, scan history, reports, scan output |
| Wrapper workspace adapters | File reads/writes, bounded symlink-safe reads, YAML/Markdown translation, backups |
| Wrapper engine adapter | Spawns `scan.mjs` with allowlisted args, timeout, bounded output |
| Wrapper evaluation | Fetches the posting (SSRF-guarded), builds the fenced prompt, runs the fixed tool-less AI CLI command, validates its JSON, writes the report and tracker row |
| Wrapper runs | In-memory scan run and evaluation registries (one active run each) |
| Wrapper security | Path containment, pairing token guard, redaction |
| Career Ops workspace | Source-of-truth files and local scripts |

## Android Data Flow

```mermaid
flowchart TD
  Screen["Compose Screen"]
  VM["ViewModel"]
  UseCase["Use Case"]
  Repo["Repository Interface"]
  RepoImpl["Repository Impl"]
  Local["Room cache (planned)"]
  Remote["Retrofit CareerOpsApi"]

  Screen --> VM
  VM --> Repo
  VM -.-> UseCase
  UseCase --> Repo
  Repo --> RepoImpl
  RepoImpl --> Local
  RepoImpl --> Remote
```

Rules:

- UI must not import data-layer DTOs/entities.
- Repositories translate transport/storage models into domain models.
- Room (when added) is a projection cache, not Career Ops source of truth.
- Errors cross layers as `Either<AppError, T>`; details in
  `android/docs/system-architecture.md`.

## Wrapper Request Flow

```mermaid
flowchart TD
  Request["HTTP request"]
  Guard["Pairing token guard"]
  Route["Route parser"]
  Contract["Zod contract"]
  Service["Service"]
  Adapter["Workspace adapter"]
  Response["DTO response"]

  Request --> Guard
  Guard --> Route
  Route --> Contract
  Contract --> Service
  Service --> Adapter
  Adapter --> Service
  Service --> Response
```

Rules:

- Public setup endpoints: `/api/v1/health`, `/docs`, `/openapi.json`.
- Protected endpoints require pairing token when wrapper binds to LAN/private
  host.
- Workspace writes go through safe adapters.
- Generic command execution endpoints are forbidden.
- Offers, reports, and artifacts are read-only projections; their IDs are
  opaque hashes or report numbers, matched against listings, never joined
  into paths.

## Scan Run Lifecycle

```mermaid
sequenceDiagram
  participant App as Android app
  participant API as Wrapper
  participant Scan as node scan.mjs
  App->>API: POST /api/v1/scan-runs {dryRun, company}
  API->>API: reserve single slot, check scan readiness
  API->>Scan: spawn (no shell, allowlisted argv, CAREER_OPS_* stripped)
  API-->>App: 202 ScanRunDto running
  loop polling
    App->>API: GET /api/v1/scan-runs/{id}
    API-->>App: ScanRunDto
  end
  Scan-->>API: exit code, bounded stdout/stderr
  API->>API: parse summary, redact warnings
  App->>API: GET /api/v1/offers
```

`scan.mjs` only finds job links and writes `data/pipeline.md` and
`data/scan-history.tsv`. Offers found from the phone show
`evaluationStatus: "notEvaluated"` until an AI evaluation runs, on the desktop
or through the evaluation lifecycle below.

## AI Evaluation Lifecycle

Off unless the desktop sets `CAREER_OPS_EVALUATION_PROVIDER=claude`. The phone
sends only an `offerId`; it cannot pick the provider, model, prompt, URL, or
any flag. Design: `docs/superpowers/specs/2026-10-31-ai-offer-evaluation-design.md`.

```mermaid
sequenceDiagram
  participant App as Android app
  participant API as Wrapper
  participant Web as Job posting URL
  participant CLI as claude -p (no tools)
  participant WS as Career Ops workspace
  App->>API: POST /api/v1/evaluations {offerId}
  API->>API: one active slot, fresh readiness (CLI logged in), offer notEvaluated
  API-->>App: 202 EvaluationDto running
  API->>Web: GET offer URL (SSRF guard, 2 MiB, 20 s)
  API->>CLI: fixed argv, env allowlist, empty temp cwd, prompt on stdin
  CLI-->>API: one JSON object (validated with Zod)
  API->>WS: reserve-report-num.mjs, write reports/NNN-…md, release
  API->>WS: merge-tracker.mjs (one row, private additions dir)
  loop polling
    App->>API: GET /api/v1/evaluations/{id}
  end
  App->>API: GET /api/v1/offers (now evaluated)
```

Security boundary:

- The model gets **no tools** (`--tools ""`, `--strict-mcp-config`,
  `--safe-mode`, `--permission-mode dontAsk`, `--permission-prompts none`).
  It cannot read files, run commands, browse, or write. The wrapper does all
  disk and network work itself.
- The child env is an allowlist (`HOME`, `USER`, `LOGNAME`, `PATH`, `SHELL`,
  `TMPDIR`, `LANG`, `LC_*`), so the pairing token and API keys never reach it;
  the CLI uses the desktop's subscription login.
- The posting and the scan metadata are untrusted: every prompt block is
  fenced with a random nonce and its closing-tag text removed. The report
  header, file name and tracker cells come from the projection, not the model.
- Writes: one new `reports/NNN-<slug>-<date>.md` (create-only), the
  `reserve-report-num.mjs` sentinel, and `data/applications.md` through
  `merge-tracker.mjs`. Nothing in `output/`.
- Clients only ever see fixed sentences; CLI output, the prompt, the posting
  and paths are never returned or logged.
- One evaluation at a time; a scan may run at the same time (different
  files). Cancel works until the write step starts.

## Runtime Configuration

Wrapper config order:

1. CLI flags
2. `.env`
3. safe defaults

Defaults:

```text
CAREER_OPS_HOST=127.0.0.1
CAREER_OPS_PORT=3000
CAREER_OPS_PAIRING_TOKEN=
CAREER_OPS_EVALUATION_PROVIDER=          # unset = AI evaluation off; `claude`
CAREER_OPS_EVALUATION_TIMEOUT_MS=900000  # 60000–3600000
CAREER_OPS_EVALUATION_CLI=               # optional absolute path; default `claude` on PATH
```

Android dev flavor points to:

```text
http://10.0.2.2:3000
```

## API Surface

Current wrapper route families:

- Health and readiness.
- CV Markdown read/write.
- Profile config read/write.
- Portal config read/write.
- Scan readiness.
- Scan run start/status (`/scan-runs`).
- AI evaluation start/status/cancel (`/evaluations`).
- Offers projection (`/offers`).
- Reports (`/reports`) and artifacts (`/artifacts`, PDF download).
- API docs/OpenAPI.

## Key Architecture Decisions

- Wrapper over direct Android workspace access.
- Career Ops workspace as source of truth.
- Android Room as a projection cache (planned, Story 2.6).
- Fastify + Zod as API boundary.
- Polling is acceptable for MVP scan lifecycle.
- Local Pairing Token protects LAN/private wrapper use.
- Opaque backend IDs for offers (`offer_<hash>`), reports (`report_NNN`),
  artifacts (`artifact_<hash>`), and scan runs (`scan_<time>_<hex>`).
- Scan runs and evaluations are kept in memory; a wrapper restart forgets them.
- AI evaluation runs the desktop's logged-in CLI with no tools; the wrapper
  fetches and writes (owner decisions, 2026-10-31).

## Risk Areas

- Contract drift between wrapper DTOs and Android DTOs.
- Accidental raw path exposure.
- Cleartext dev networking leaking into prod.
- Workspace writes that fail to preserve unknown fields.
- Scan or evaluation execution becoming generic command execution.
- AI CLI flag changes in a CLI update (the argv test pins the exact list; an
  unknown flag fails closed).
- Android cache diverging from Career Ops workspace without freshness labels.
