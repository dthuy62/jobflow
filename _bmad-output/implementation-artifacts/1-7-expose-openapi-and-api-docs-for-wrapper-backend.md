---
created: 2026-06-22
story_key: 1-7-expose-openapi-and-api-docs-for-wrapper-backend
owner: Codex
baseline_commit: f52d54296ca205fef486f4213781ceabebdefa82
---

# Story 1.7: Expose OpenAPI and API Docs for Wrapper Backend

Status: review

Owner: Codex

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a mobile/backend developer,
I want a browser-viewable API reference and machine-readable OpenAPI document for the Wrapper Backend,
so that I can inspect and test available APIs visually while keeping Android and backend contracts aligned.

## Acceptance Criteria

1. Given the Wrapper Backend is running, when a developer opens `GET /docs`, then a browser-viewable API reference is served for the current Wrapper Backend API without requiring command-line curl usage.
2. Given the Wrapper Backend is running, when `GET /openapi.json` is called, then the response is a valid OpenAPI document describing the currently implemented public API surface, including `GET /api/v1/health`.
3. Given the OpenAPI document is inspected, when `GET /api/v1/health` is viewed, then the documented response schema matches the existing `HealthDtoSchema` fields from Story 1.3, including `apiVersion`, `workspace`, `careerOps`, `capabilities`, and `serverTime`.
4. Given Local Pairing Token rules exist, when the OpenAPI document is inspected, then it documents the `X-Career-Ops-Token` security scheme for protected API routes while making clear that `GET /api/v1/health`, `/docs`, and `/openapi.json` are setup/developer endpoints that do not require the token.
5. Given future endpoint families are not implemented yet, when docs are viewed, then the API reference does not advertise CV/Profile/Portal/Scan/Offer/Report/Artifact endpoints as callable until their routes are actually implemented.
6. Given the docs are served in localhost or LAN mode, when docs or OpenAPI are requested, then no absolute workspace path, Local Pairing Token value, CV content, profile content, or provider/API key value is included in the generated spec or UI configuration.
7. Given contract examples and docs tests run, when the OpenAPI document is generated, then tests prove it is parseable, stable enough for developer use, and consistent with checked-in health/error examples.

## Tasks / Subtasks

- [x] Add OpenAPI document generation from existing contracts. (AC: 2, 3, 4, 5, 6, 7)
  - [x] Add a focused module such as `career-ops-wrapper/src/openapi/openapi-document.ts`.
  - [x] Use existing Zod schemas from `src/contracts/` as the source of truth.
  - [x] Convert `HealthDtoSchema` and `ErrorResponseDtoSchema` to JSON Schema using Zod 4 native JSON Schema conversion.
  - [x] Build an OpenAPI document for current implemented routes only: `GET /api/v1/health`.
  - [x] Include stable `operationId`, tags, summary, description, response schemas, and example references/inline examples.
  - [x] Include `X-Career-Ops-Token` as an API key security scheme in components without applying it to `GET /api/v1/health`.

- [x] Serve docs and OpenAPI routes. (AC: 1, 2, 4, 6)
  - [x] Add route registration under a dedicated docs module, for example `src/api/docs-routes.ts` or `src/openapi/docs-routes.ts`.
  - [x] Serve `GET /openapi.json` as JSON with the generated OpenAPI document.
  - [x] Serve `GET /docs` as a browser-viewable API reference using Scalar API Reference or an equivalent local Fastify-compatible docs UI.
  - [x] Keep `/api/v1` application routes unchanged; docs endpoints are developer/setup endpoints outside the `/api/v1` data API.
  - [x] Ensure docs routes do not expose workspace paths, token values, CV content, profile content, or provider secrets.

- [x] Wire docs into server startup safely. (AC: 1, 2, 4, 6)
  - [x] Register docs routes from `createServer()` or top-level route registration without breaking existing `/api/v1` route behavior.
  - [x] Preserve `GET /api/v1/health` public LAN behavior from Story 1.3.
  - [x] Do not protect `/docs` or `/openapi.json` with Local Pairing Token in this story; instead keep them read-only and secret-free.
  - [x] Do not add authentication systems, Firebase App Check, database-backed sessions, or public cloud assumptions.

- [x] Add tests for API docs behavior. (AC: 1-7)
  - [x] Add Fastify inject tests for `GET /openapi.json` returning HTTP 200 and a parseable OpenAPI object.
  - [x] Add Fastify inject tests for `GET /docs` returning HTML.
  - [x] Add assertions that `/openapi.json` includes `/api/v1/health` and does not include unimplemented endpoint families.
  - [x] Add assertions that the health response schema in OpenAPI includes Story 1.3 fields.
  - [x] Add assertions that no configured workspace path or pairing token appears in docs/OpenAPI output.
  - [x] Add tests that docs/OpenAPI remain reachable in LAN/private host config without requiring `X-Career-Ops-Token`.

- [x] Update README and contract documentation. (AC: 1, 2, 4, 5, 6)
  - [x] Document `http://127.0.0.1:3000/docs` and `http://127.0.0.1:3000/openapi.json`.
  - [x] Explain that docs show only implemented routes.
  - [x] Explain that Local Pairing Token is documented as a security scheme but not required for health/docs endpoints.
  - [x] Explain that docs are for local/personal developer use and must not contain secrets.

- [x] Run validations. (AC: 7)
  - [x] Run `npm test` in `career-ops-wrapper`.
  - [x] Run `npm run build` in `career-ops-wrapper`.
  - [x] Run repo-level `./gradlew test` to guard Android regression even though Android implementation is out of scope.

## Dev Notes

### Scope Boundary

This story adds API visualization and OpenAPI documentation only. It must not implement CV/Profile/Portal read-write APIs, scan-run creation, offer parsing, report/artifact serving, Android UI, Room cache, authentication accounts, Firebase App Check, or any Career Ops script execution.

The expected user-visible result is:

- open browser at `/docs`;
- inspect `GET /api/v1/health`;
- open `/openapi.json`;
- use the OpenAPI contract as a developer aid for Android/backend alignment.

### Product and Architecture Context

Epic 1 is about connecting to a real Career Ops Workspace and verifying the API contract foundation before job-search workflows begin. Architecture requires:

- REST API under `/api/v1`;
- Fastify + Zod backend boundary;
- Zod schemas as backend source of truth;
- checked-in contract examples under `career-ops-wrapper/contracts/examples`;
- Android DTOs and repositories consuming stable backend contracts;
- OpenAPI-style or JSON-schema-style contract derived from Zod where practical.

Architecture explicitly deferred "Generate OpenAPI from Zod after the wrapper contract stabilizes." Story 1.3 stabilized the Health DTO and readiness contract, so this supplemental Story 1.7 promotes docs for the currently implemented API surface only.

### Recommended Implementation Approach

Prefer a small manual OpenAPI document builder over broad route/framework rewrites.

Recommended files:

```text
career-ops-wrapper/src/openapi/openapi-document.ts
career-ops-wrapper/src/api/docs-routes.ts
career-ops-wrapper/src/server.ts
career-ops-wrapper/src/api/register-routes.ts
career-ops-wrapper/test/openapi-document.test.ts
career-ops-wrapper/test/docs-route.test.ts
career-ops-wrapper/README.md
career-ops-wrapper/package.json
career-ops-wrapper/package-lock.json
```

Keep existing route handlers thin. Do not move health business logic out of:

- `src/api/health-routes.ts`
- `src/services/health-service.ts`
- `src/contracts/health-contract.ts`

### Library and Version Guidance

Current backend stack:

- Node/TypeScript ESM project.
- Fastify `^5.8.5`.
- Zod `^4.4.3`.
- Vitest `^4.1.9`.

Recommended docs UI:

- Add `@scalar/fastify-api-reference` for `/docs`.
- Serve the OpenAPI document from the wrapper itself at `/openapi.json`.
- Configure Scalar with `url: "/openapi.json"` or equivalent so the UI reads the local spec.

Avoid `zod-to-json-schema` unless implementation proves Zod 4 native conversion is insufficient. Zod 4 includes first-party JSON Schema conversion via `z.toJSONSchema()`, and architecture already makes Zod the source of truth.

Avoid `fastify-swagger` package name; that old package is deprecated. If the developer chooses Fastify Swagger generation instead of the manual builder, use `@fastify/swagger` with a version compatible with Fastify 5 and register it before routes. This story's preferred path is simpler: manual OpenAPI JSON from Zod + Scalar UI.

### OpenAPI Contract Requirements

The OpenAPI document should include:

- `openapi`: use a stable OpenAPI version such as `3.1.0` unless library constraints require `3.0.x`.
- `info.title`: `Career Ops Wrapper API`.
- `info.version`: use wrapper package version or `1.0.0`.
- `servers`: at least local development server URL `http://127.0.0.1:3000`.
- `tags`: include `Health`.
- `paths["/api/v1/health"].get`.
- `operationId`: `getHealth`.
- response `200` schema referencing `HealthDto`.
- response `500` schema referencing `ErrorResponseDto` if useful.
- `components.securitySchemes.LocalPairingToken`:
  - `type: "apiKey"`
  - `in: "header"`
  - `name: "X-Career-Ops-Token"`
  - description clearly states it protects non-health routes in LAN/private mode and is not user authentication.
- `components.schemas.HealthDto` generated from `HealthDtoSchema`.
- `components.schemas.ErrorResponseDto` generated from `ErrorResponseDtoSchema`.

Do not document future endpoints yet:

- `/api/v1/cv`
- `/api/v1/profile`
- `/api/v1/portals`
- `/api/v1/scan-runs`
- `/api/v1/offers`
- `/api/v1/reports`
- `/api/v1/artifacts`
- `/api/v1/run`
- `/api/v1/exec`
- `/api/v1/command`

### Security and Privacy Requirements

Docs/OpenAPI output must be deterministic and secret-free:

- no absolute workspace path;
- no pairing token value;
- no CV content;
- no profile content;
- no API/provider keys;
- no local machine username;
- no command strings that imply arbitrary shell execution.

Docs endpoints are read-only developer/setup endpoints. They may be public in localhost/LAN for MVP as long as output is secret-free. Do not change Local Pairing Token guard semantics for `/api/v1` non-health routes.

### Previous Story Intelligence

Story 1.1 established:

- `createServer()` lives in `career-ops-wrapper/src/server.ts`.
- `/api/v1` route registration lives in `src/api/register-routes.ts`.
- Route files should remain HTTP mapping only.
- Contracts live in `src/contracts`.
- Contract examples live under `contracts/examples`.
- `npm test`, `npm run build`, and `./gradlew test` are the expected validation commands.
- Do not expose `/run`, `/exec`, `/command`, or any generic shell command endpoint.

Story 1.2 established:

- Runtime config has `host`, `port`, `workspace`, and optional `pairingToken`.
- Local Pairing Token header is `X-Career-Ops-Token`.
- Health remains public in LAN mode.
- Redaction must prevent token and workspace path leaks.

Story 1.3 established:

- `HealthDtoSchema` includes `status`, `apiVersion`, `workspace`, `careerOps`, `capabilities`, and `serverTime`.
- `capabilities.scan`, `capabilities.reports`, and `capabilities.artifacts` stay false until their endpoint families exist.
- Script readiness is not AI CLI readiness and not provider API-key readiness.
- Review hardening requires workspace/script file checks to stay inside workspace boundaries and avoid path leaks.

### Testing Requirements

Use Vitest and Fastify inject tests. Tests should not require a real Career Ops Workspace, browser automation, Android emulator, or real network port.

Minimum backend tests:

- `GET /openapi.json` returns status 200 and JSON with `openapi`, `info`, `paths`, and `components`.
- OpenAPI contains exactly the implemented public route path `/api/v1/health` among app routes.
- OpenAPI does not contain `/api/v1/run`, `/api/v1/exec`, `/api/v1/command`, or future endpoint families.
- OpenAPI includes `HealthDto` schema fields from Story 1.3.
- OpenAPI includes `LocalPairingToken` security scheme but `GET /api/v1/health` has no security requirement.
- `GET /docs` returns HTML content and references the local `/openapi.json` spec.
- LAN/private config can fetch `/docs` and `/openapi.json` without token.
- No docs/OpenAPI response contains the configured workspace path or configured pairing token.

Run:

```bash
cd career-ops-wrapper && npm test
cd career-ops-wrapper && npm run build
./gradlew test
```

### Latest Technical Notes

- `@fastify/swagger` supports OpenAPI v3 generation for Fastify and version `>=9.x` is compatible with Fastify `^5.x`; if used, it must be registered before routes so route discovery works. Source: [@fastify/swagger docs](https://github.com/fastify/fastify-swagger).
- Fastify's ecosystem lists `@fastify/swagger` for dynamic Swagger/OpenAPI documentation and `@fastify/swagger-ui` for Swagger UI. Source: [Fastify ecosystem](https://fastify.dev/ecosystem/).
- Scalar's Fastify integration can render an API reference from an OpenAPI/Swagger document and can be configured with a local spec URL such as `/openapi.json`. Source: [Scalar Fastify integration](https://scalar.com/products/api-references/integrations/fastify).
- Zod 4 supports first-party JSON Schema conversion via `z.toJSONSchema()`, and JSON Schema is commonly used in OpenAPI definitions. Source: [Zod JSON Schema docs](https://zod.dev/json-schema).

### Project Structure Notes

This is a backend-only story. Android source should remain untouched except for repo-level regression tests. No `project-context.md` was found during story creation.

## References

- [Architecture API Contract Versioning](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md:104)
- [Architecture Stack](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md:215)
- [Architecture API Naming](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md:529)
- [Architecture Contract Ownership](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md:1290)
- [Architecture OpenAPI Deferred Work](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/architecture.md:1761)
- [Epics Additional Requirements](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/epics.md:81)
- [Epics Story 1.6 Contract Compatibility](/Users/dthuy/Workspace/task-arena/_bmad-output/planning-artifacts/epics.md:356)
- [Story 1.3 Previous Implementation](/Users/dthuy/Workspace/task-arena/_bmad-output/implementation-artifacts/1-3-expose-health-and-workspace-readiness-api.md:1)
- [@fastify/swagger](https://github.com/fastify/fastify-swagger)
- [Fastify ecosystem](https://fastify.dev/ecosystem/)
- [Scalar Fastify integration](https://scalar.com/products/api-references/integrations/fastify)
- [Zod JSON Schema](https://zod.dev/json-schema)

## Change Log

- 2026-06-22: Created supplemental Epic 1 Story 1.7 for OpenAPI JSON and browser API docs.
- 2026-06-22: Implemented OpenAPI JSON generation, browser docs route, Scalar docs assets, docs tests, README docs, and validation evidence.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-06-22: Added red-phase tests for `GET /openapi.json` and `GET /docs`; initial run failed because the OpenAPI module was missing and both docs routes returned 404.
- 2026-06-22: Installed `@scalar/fastify-api-reference` and implemented manual OpenAPI 3.1 document generation from existing Zod contracts.
- 2026-06-22: Adjusted docs route to serve `/docs` directly while using local Scalar assets under `/docs-assets` to avoid redirect-only behavior.
- 2026-06-22: Validation passed: `npm test` (13 files, 92 tests), `npm run build`, and repo-level `./gradlew test`.

### Completion Notes List

- Story created as a supplemental backend developer-experience story after Hy requested visual API inspection similar to Swagger.
- Story intentionally documents only currently implemented API routes and must not claim future endpoint families are callable.
- `GET /openapi.json` now returns a deterministic OpenAPI 3.1 document with `HealthDto`, `ErrorResponseDto`, and `LocalPairingToken` security scheme.
- `GET /docs` now returns browser-viewable Scalar API docs backed by the local `/openapi.json` spec and remains public/secret-free in LAN mode.
- No CV/Profile/Portal/Scan/Offer/Report/Artifact endpoints were added or documented in this story.

### File List

- `career-ops-wrapper/package.json`
- `career-ops-wrapper/package-lock.json`
- `career-ops-wrapper/README.md`
- `career-ops-wrapper/src/api/docs-routes.ts`
- `career-ops-wrapper/src/openapi/openapi-document.ts`
- `career-ops-wrapper/src/server.ts`
- `career-ops-wrapper/test/docs-route.test.ts`
- `career-ops-wrapper/test/openapi-document.test.ts`
