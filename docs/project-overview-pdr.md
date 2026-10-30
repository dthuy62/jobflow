# Project Overview PDR

## Overview

JobFlow is a personal job application assistant. The product combines a native
Android client with a local Career Ops wrapper API so a user can manage career
inputs, check workspace readiness, and eventually run real Career Ops scans
from mobile.

The current workspace contains:

- `android/`: native Kotlin/Jetpack Compose app.
- `career-ops-wrapper/`: local Node.js/TypeScript Fastify API.
- `_bmad-output/`: planning and architecture artifacts from earlier product
  work.

## Product Intent

JobFlow should help one user move faster through job-search operations without
turning the phone into a direct file editor or command runner. The Android app
is the interaction surface. The wrapper is the anti-corruption layer around
Career Ops workspace files and scripts.

## Primary Users

| User | Need |
| --- | --- |
| JobFlow owner | Run and inspect job-search workflows from Android |
| Developer/agent | Change the app safely without breaking local workspace boundaries |

## Current Capabilities

| Area | State |
| --- | --- |
| Android app | Rebuilt from android-agentic-starter; Home/Inputs/Settings tabs |
| Android wrapper client | Health implemented (cached, Home + Settings); contract tests cover all DTO families |
| Wrapper API foundation | Implemented under `/api/v1` with Fastify |
| Wrapper health/readiness | Implemented with workspace and local script readiness |
| CV/profile/portal API | Implemented in wrapper with Zod contracts and safe adapters |
| API docs | Implemented at `/docs` and `/openapi.json` |
| Scan execution | Not implemented; adapter interface and readiness checks exist |
| Offers/reports/artifacts | Planned, not implemented as endpoint families |

## Product Requirements

1. Android must remain the mobile user interface, not a direct workspace file
   editor.
2. Career Ops workspace files remain the source of truth.
3. The wrapper owns workspace validation, safe file IO, command allowlists,
   path containment, and local pairing token enforcement.
4. Android consumes versioned wrapper DTOs and checked-in contract examples.
5. Core flows must work locally without cloud auth or provider API keys.
6. Logs and errors must not expose CV/profile content, pairing tokens, provider
   keys, or local machine paths.

## Non-Goals

- Cloud multi-user backend.
- Generic remote command execution.
- Android direct access to Career Ops workspace files.
- Full AI provider/evaluator orchestration in the current MVP.
- Replacing the native Android app with Flutter or iOS.

## Success Criteria

- Android can diagnose wrapper/workspace readiness through `/api/v1/health`.
- Wrapper contract examples stay aligned with Android DTO tests.
- CV/profile/portal writes preserve workspace safety boundaries.
- Scan execution is added only through typed wrapper operations.
- Documentation remains concise enough for humans and coding agents to use.

## References

- `README.md`
- `android/AGENTS.md`
- `career-ops-wrapper/README.md`
- `_bmad-output/planning-artifacts/architecture.md`
