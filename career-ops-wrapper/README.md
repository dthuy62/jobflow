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
| `GET /offers`, `GET /offers/{id}` | Read-only offer projection |
| `GET /reports`, `GET /reports/{id}` | Read-only evaluation reports with Markdown |
| `GET /artifacts`, `GET /artifacts/{id}/download` | Read-only PDFs from `output/` |

## Scan Runs

Scan execution goes through the typed `career-ops-engine` adapter (`runScan()`). The wrapper never exposes generic shell endpoints such as `/run`, `/exec`, or `/command`, and never runs AI CLIs or provider scripts: `scan.mjs` only finds job links. Scores and reports come from AI evaluation run on the desktop.

- The wrapper spawns `node scan.mjs` with the current Node binary, the workspace as `cwd`, and no shell.
- Only `--dry-run` and `--company <name>` are forwarded. `--verify` and the other flags are not exposed.
- Only one scan runs at a time; a second start returns `409 SCAN_ALREADY_RUNNING`. A start while scan readiness is not ready returns `503 WORKSPACE_UNHEALTHY` with `details.reason: "scan-not-ready"`.
- `CAREER_OPS_*` variables are removed from the child environment.
- Runs time out after 10 minutes by default (`CAREER_OPS_SCAN_TIMEOUT_MS`, 1000–3600000).
- stdout/stderr are bounded and never returned raw. Summary counts and warnings are parsed from the scan summary and redacted.
- Run state is in memory; a wrapper restart forgets past runs.

## Offers, Reports, and Artifacts

These are read-only projections. The wrapper never edits the tracker, reports, or PDFs.

- Offers merge `data/scan-history.tsv`, `data/pipeline.md`, `data/applications.md`, and report `**URL:**` headers by normalized URL. IDs are `offer_<16 hex>` hashes, never paths.
- Scores map Career Ops `x/5` to 0–100 (`4.2/5` → `84`). Offers with no score or report have `evaluationStatus: "notEvaluated"`.
- Reports are `reports/NNN-<slug>.md` files with IDs `report_NNN`. Markdown is returned with workspace and home paths redacted; reports over 1 MiB return `413`.
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

Script readiness does not run `doctor.mjs`, does not run `scan.mjs`, and does not invoke Antigravity, Claude, Gemini, Codex, OpenCode, Qwen, or provider API-key evaluator scripts. It is not AI CLI readiness and not Gemini/OpenAI/Anthropic API-key readiness.

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
