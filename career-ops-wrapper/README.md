# Career Ops Wrapper

Local Node.js/TypeScript wrapper API for Career Ops Mobile.

## Commands

```bash
npm install
npm run dev
npm run build
npm test
```

`npm run dev` starts the Fastify server with `tsx`.

## Scope

The wrapper is the only integration surface the Android app should call. Career Ops Workspace files remain the source of truth. Android Room is a projection cache only.

All routes live under `/api/v1`. Workspace validation and path containment keep the configured Career Ops Workspace as the only file boundary the wrapper may touch. Android should consume the checked-in JSON examples under `contracts/examples`.

| Route | Purpose |
| --- | --- |
| `GET /health` | Wrapper, workspace, and script readiness (public) |
| `GET`/`PUT /cv`, `/profile`, `/portals` | Career inputs |
| `GET /scan-readiness` | Scan gating checklist |
| `POST /scan-runs` | Start `scan.mjs` (body `{ "dryRun": false, "company": "Acme" }`, both optional) |
| `GET /scan-runs/latest`, `GET /scan-runs/{id}` | Poll scan run status |
| `POST /evaluations` | AI-evaluate one offer (body `{ "offerId": "offer_…" }`); off unless the desktop enables it |
| `GET /evaluations/latest`, `GET /evaluations/{id}`, `POST /evaluations/{id}/cancel` | Poll or cancel an evaluation |
| `GET /offers`, `GET /offers/{id}` | Read-only offer projection |
| `GET /reports`, `GET /reports/{id}` | Read-only evaluation reports with Markdown |
| `GET /artifacts`, `GET /artifacts/{id}/download` | Read-only PDFs from `output/` |

## Scan Runs

Scan execution goes through the typed `career-ops-engine` adapter (`runScan()`). The wrapper never exposes generic shell endpoints such as `/run`, `/exec`, or `/command`. `scan.mjs` only finds job links; scores and reports come from AI evaluation, on the desktop or through [AI Evaluations](#ai-evaluations).

- The wrapper spawns `node scan.mjs` with the current Node binary, the workspace as `cwd`, and no shell.
- Only `--dry-run` and `--company <name>` are forwarded. `--verify` and the other flags are not exposed. `company` is any trimmed name of 1–100 characters that does not start with `-` and has no control characters or line breaks; it is one argv element.
- Only one scan runs at a time; a second start returns `409 SCAN_ALREADY_RUNNING`. A start while scan readiness is not ready returns `503 WORKSPACE_UNHEALTHY` with `details.reason: "scan-not-ready"`.
- `CAREER_OPS_*` variables are removed from the child environment.
- Runs time out after 10 minutes by default (`CAREER_OPS_SCAN_TIMEOUT_MS`, 1000–3600000).
- stdout/stderr are bounded and never leave the wrapper. Warnings and failure messages are fixed sentences built from `portals.yml` company names, an error category, and counts; unknown companies, and names that would echo a path, URL credential or token, are only counted.
- `summary.offersProjected` is the `New offers added:` count, also for a failed run (rows are written before the summary); 0 for dry runs.
- Run state is in memory; a wrapper restart forgets past runs.

## AI Evaluations

Off unless the desktop sets `CAREER_OPS_EVALUATION_PROVIDER=claude`. It uses the desktop's logged-in `claude` CLI and its **subscription quota** (log in once with `claude auth login` in a normal terminal). Design and owner decisions: `docs/superpowers/specs/2026-10-31-ai-offer-evaluation-design.md`.

- The phone sends only `offerId`. The offer must have a URL and be `notEvaluated` (else `400` with `details.reason` `offer-has-no-url` or `offer-already-evaluated`).
- One evaluation at a time (`409 EVALUATION_ALREADY_RUNNING` with `details.activeEvaluationId`); a scan may run at the same time. Not ready returns `503 WORKSPACE_UNHEALTHY` with `details.reason: "evaluation-not-ready"` and `details.missingRequirements`.
- The wrapper fetches the posting itself: `http`/`https` on default ports only, no private or local addresses (IP literals and every resolved address are checked, also after redirects), no proxy, 2 MiB, 20 s. Pages that need JavaScript usually fail with `POSTING_UNAVAILABLE`; a schema.org `JobPosting` in the page is used when present.
- The CLI runs as `claude -p` with **no tools** (`--tools ""`), no MCP, no hooks or project instructions (`--safe-mode`), an empty temporary `cwd`, an allowlisted environment (no `CAREER_OPS_*`, no API keys), and the prompt on stdin. Its JSON answer is validated with Zod.
- The wrapper then writes one new `reports/NNN-<slug>-<date>.md` (number from `reserve-report-num.mjs`, header built from the offer, never overwriting) and one tracker row through `merge-tracker.mjs`, unless the offer already has a tracker row. Nothing is written to `output/`.
- Cancel works until the write step starts. Runs time out after 15 minutes by default (`CAREER_OPS_EVALUATION_TIMEOUT_MS`, 60000–3600000).
- Failures are fixed codes and sentences (`POSTING_UNAVAILABLE`, `CLI_NOT_LOGGED_IN`, `CLI_LIMIT_REACHED`, `COMMAND_TIMEOUT`, `COMMAND_FAILED`, `SPAWN_FAILED`, `OUTPUT_INVALID`, `WRITE_FAILED`, `CANCELLED`); CLI output, the prompt and the posting never leave the wrapper.
- Known limit: `batch/batch-runner.sh` numbers reports without sentinels, so running it at the same time as an app evaluation may reuse a report number.

## Offers, Reports, and Artifacts

These are read-only projections. Apart from AI evaluations (above), the wrapper never edits the tracker, reports, or PDFs.

- Offers merge `data/scan-history.tsv`, `data/pipeline.md`, `data/applications.md`, and report `**URL:**` headers by normalized URL. IDs are `offer_<16 hex>` hashes, never paths.
- Scores map Career Ops `x/5` to 0–100 (`4.2/5` → `84`). Offers with no score or report have `evaluationStatus: "notEvaluated"`.
- Reports are `reports/NNN-<slug>.md` files with IDs `report_NNN`. A report's `offerId` is the offer of its own `**URL:**`, else of the tracker row that links it. An offer with an evaluation report and no tracker row is `tracked`. Links to workspace PDFs (and the `**PDF:**` header) are rewritten to `/api/v1/artifacts/{id}/download`, links to other reports to `/api/v1/reports/{id}`, other local links become plain text, and local paths become `[local path]`; reports over 1 MiB return `413`.
- Artifacts are regular PDF files directly inside `output/`, with IDs `artifact_<16 hex>`. Downloads stream with `Content-Type: application/pdf` and `Content-Disposition: attachment`.
- Symbolic links in `reports/` and `output/` are skipped, and IDs are matched against directory listings instead of being joined into paths.

## Runtime Configuration

Configuration order is CLI flags, `.env`, then safe defaults:

```bash
npm run dev -- --workspace /path/to/career-ops
```

```env
CAREER_OPS_HOST=127.0.0.1
CAREER_OPS_PORT=3000
CAREER_OPS_PAIRING_TOKEN=
CAREER_OPS_SCAN_TIMEOUT_MS=600000
CAREER_OPS_EVALUATION_PROVIDER=          # unset = AI evaluation off; `claude`
CAREER_OPS_EVALUATION_TIMEOUT_MS=900000
CAREER_OPS_EVALUATION_CLI=               # optional absolute path; default `claude` on PATH
```

If `--workspace` is omitted, the current working directory is used as the workspace candidate. The Android app must not receive or store that absolute local path.

Localhost mode (`127.0.0.1`, `localhost`, `::1`) may omit `CAREER_OPS_PAIRING_TOKEN`. LAN/private mode, such as `CAREER_OPS_HOST=0.0.0.0`, requires requests to protected routes to include `X-Career-Ops-Token: <token>`.

The Local Pairing Token is a personal LAN safety check for this local-first wrapper. It is not user authentication, not a public API key, and not Firebase App Check. Firebase App Check is deferred because this MVP is not a public cloud backend.

## Local Smoke Run

`fixtures/workspaces/career-ops-projection/` is a synthetic workspace with a deterministic `scan.mjs`. Copy it first, because a non-dry-run scan appends to its `data/` files:

```bash
cp -R fixtures/workspaces/career-ops-projection /tmp/career-ops-fixture
npm run dev -- --workspace /tmp/career-ops-fixture
curl -X POST http://127.0.0.1:3000/api/v1/scan-runs -H 'Content-Type: application/json' -d '{"dryRun":true}'
curl http://127.0.0.1:3000/api/v1/scan-runs/latest
curl http://127.0.0.1:3000/api/v1/offers
```

## Health and Readiness

Check backend and workspace readiness with:

```bash
curl http://127.0.0.1:3000/api/v1/health
```

`GET /api/v1/health` is public in localhost and LAN mode so Android can diagnose setup before calling protected APIs. In LAN mode, other `/api/v1` routes still require `X-Career-Ops-Token`.

The health payload separates API capabilities from Career Ops local script readiness:

- `workspace` reports whether the configured Career Ops Workspace has the expected source-of-truth files.
- `careerOps.scanner` reports whether the zero-token local script prerequisites are present: `doctor.mjs`, `scan.mjs`, and `portals.yml`.
- `capabilities.scan` is `true` when the workspace and local scan scripts are ready; `capabilities.reports` and `capabilities.artifacts` are `true` when the workspace is ready.

Script readiness does not run `doctor.mjs`, does not run `scan.mjs`, and does not invoke any AI CLI or provider API-key evaluator script.

- `careerOps.evaluator` reports AI evaluation readiness: `status` (`ready`, `notReady`, `disabled`), `provider`, and `missingRequirements` (for example `evaluation.cli-logged-out`, `cv.missing`, `tracker.missing`). `careerOps.aiCliRequired` is `true` when a provider is configured, and `capabilities.aiEvaluation` is `true` when the evaluator is ready. `capabilities.geminiEvaluation` is deprecated and always `false`.
- The CLI login check runs `claude auth status --json`, reads only `loggedIn`, and is cached for 60 seconds and shared between concurrent health calls. Health shows no path, account, or auth method. Evaluation readiness never changes the overall `status`.

## API Docs

Open the browser-viewable API reference at:

```text
http://127.0.0.1:3000/docs
```

Fetch the machine-readable OpenAPI document at:

```text
http://127.0.0.1:3000/openapi.json
```

The docs show only implemented routes, with examples loaded from `contracts/examples`.

The OpenAPI document includes `X-Career-Ops-Token` as the Local Pairing Token security scheme for every protected route. `GET /api/v1/health`, `/docs`, and `/openapi.json` remain public setup/developer endpoints and do not require the token. Docs are for local/personal developer use and must not contain workspace paths, token values, CV/profile content, or provider API keys.
