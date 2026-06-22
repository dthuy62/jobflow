# Addendum: Career Ops Mobile Technical Notes

This addendum preserves technical depth that informs architecture and implementation but should not overload the PRD.

## Architecture Decision

The selected MVP architecture is:

```text
Android Kotlin/Jetpack Compose app
-> Node.js/TypeScript Wrapper Backend (`career-ops-wrapper`)
-> Career Ops Workspace and Node.js scripts
```

## Backend Stack Recommendation

- Runtime: Node.js
- Language: TypeScript
- API framework: Fastify
- Runtime validation: Zod
- YAML: `js-yaml`
- Markdown parsing: `markdown-it` or unified ecosystem
- Command execution: Node `child_process` with an explicit allowlist
- Tests: Vitest
- Packaging later: Docker

## Android Stack Continuity

Keep the current Android app foundation:

- Kotlin
- Jetpack Compose
- Room
- Retrofit/OkHttp/Moshi
- Kotlin coroutines and Flow
- MVI-style state/intents/effects
- Existing neo-brutalist components and palette

## Real First Implementation Principle

The implementation should cover integration and business logic before UI completion:

1. Validate a real Career Ops Workspace.
2. Read/write real CV/Profile/Portal files safely.
3. Execute real Career Ops scan script.
4. Parse real pipeline/tracker output.
5. Only then complete polished mobile screens.

Mock/sample data may be used for tests or previews, but cannot define MVP completeness.

## Resolved MVP Defaults

- Profile editing uses the MVP Profile Fields table in the PRD.
- Portal editing uses the MVP Portal Fields table in the PRD.
- Offers use the minimum and optional Offer DTO fields defined in the PRD.
- MVP supports both emulator host loopback configuration and physical phone LAN access.
- Physical phone LAN access requires a Local Pairing Token.
- Concurrent scans are rejected while one scan is already running.
- Reports use simple in-app Markdown rendering.
- CV input is Markdown-only in MVP; PDF/DOCX conversion is deferred.
- CV Markdown maximum size is 512 KB.
- Portal Config payload maximum size is 128 KB.

## Backend API Capability Sketch

- `GET /health`
- `GET /cv`
- `PUT /cv`
- `GET /profile`
- `PUT /profile`
- `GET /portals`
- `PUT /portals`
- `POST /scan-runs`
- `GET /scan-runs/{id}`
- `GET /offers`
- `GET /offers/{id}`
- `GET /reports`
- `GET /reports/{id}`
- `GET /artifacts/{id}`

Exact schemas should be defined in architecture after inspecting a real Career Ops sample workspace.

## Key Risks To Carry Into Architecture

- Career Ops file formats may change.
- YAML/Markdown write logic can corrupt user files if not tested.
- No-auth API can expose sensitive CV data if bound beyond localhost.
- Playwright/PDF flows may require Docker or host dependency setup.
- AI/evaluation flows may not be deterministic enough for early MVP.
