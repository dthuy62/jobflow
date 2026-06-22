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

This scaffold exposes the versioned API foundation under `/api/v1` and seeds `GET /api/v1/health`. Workspace validation and path containment keep the configured Career Ops Workspace as the only file boundary the wrapper may touch. Later stories will add safe file adapters, scan runs, parsers, reports, and artifacts.

Scan execution must be exposed through typed `career-ops-engine` adapter operations such as `runScan()`. The wrapper must never expose generic shell command endpoints such as `/run`, `/exec`, or `/command`.

Android implementation is out of scope for Story 1.1. Android stories should consume the checked-in JSON examples under `contracts/examples`.

## Runtime Configuration

Configuration order is CLI flags, `.env`, then safe defaults:

```bash
npm run dev -- --workspace /path/to/career-ops
```

```env
CAREER_OPS_HOST=127.0.0.1
CAREER_OPS_PORT=3000
CAREER_OPS_PAIRING_TOKEN=
```

If `--workspace` is omitted, the current working directory is used as the workspace candidate. The Android app must not receive or store that absolute local path.

Localhost mode (`127.0.0.1`, `localhost`, `::1`) may omit `CAREER_OPS_PAIRING_TOKEN`. LAN/private mode, such as `CAREER_OPS_HOST=0.0.0.0`, requires requests to protected routes to include `X-Career-Ops-Token: <token>`.

The Local Pairing Token is a personal LAN safety check for this local-first wrapper. It is not user authentication, not a public API key, and not Firebase App Check. Firebase App Check is deferred because this MVP is not a public cloud backend.

## Health and Readiness

Check backend and workspace readiness with:

```bash
curl http://127.0.0.1:3000/api/v1/health
```

`GET /api/v1/health` is public in localhost and LAN mode so Android can diagnose setup before calling protected APIs. In LAN mode, other `/api/v1` routes still require `X-Career-Ops-Token`.

The health payload separates API capabilities from Career Ops local script readiness:

- `workspace` reports whether the configured Career Ops Workspace has the expected source-of-truth files.
- `careerOps.scanner` reports whether the zero-token local script prerequisites are present: `doctor.mjs`, `scan.mjs`, and `portals.yml`.
- `capabilities.scan`, `capabilities.reports`, and `capabilities.artifacts` stay `false` until those endpoint families are implemented.

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

The docs intentionally show only implemented routes. At this stage that means `GET /api/v1/health`; CV, profile, portal, scan, offer, report, and artifact APIs will appear only after their routes are implemented.

The OpenAPI document includes `X-Career-Ops-Token` as the Local Pairing Token security scheme for future protected API routes. `GET /api/v1/health`, `/docs`, and `/openapi.json` remain public setup/developer endpoints and do not require the token. Docs are for local/personal developer use and must not contain workspace paths, token values, CV/profile content, or provider API keys.
