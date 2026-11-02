# Hosted Backend Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running hosted backend skeleton: authenticated API, PostgreSQL,
queue worker, Docker Compose, a contract draft with a mock server Android can
use, shared modules extracted from the wrapper, and Career Ops parts vendored.
No product feature ships yet.

**Architecture:** An npm workspace holds `packages/safety`, `packages/contract`,
`backend` and the frozen `career-ops-wrapper`. The backend is a stateless
Fastify API and a pg-boss worker from one image. The core depends only on port
interfaces; a test enforces that. Every route is denied by default.

**Tech Stack:** Node 22, TypeScript, Fastify 5, Zod 4, `pg`, `pg-boss` 12,
`node-pg-migrate` 9, `jose` 6, `@fastify/rate-limit` 11, PostgreSQL 17 with
pgvector, Docker Compose, Prism (mock), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-02-jobflow-hosted-product-design.md`.
Executors read it first.

## Global Constraints

- Workflow: `docs/workflow/backend-delivery.md`. One PR per task below. Branch
  `<type>/<kebab-case>`, Conventional Commits, **no co-author trailers or tool
  attribution**. Merge commit, only after the owner says OK in chat.
- Test first. Run `review-change` at the tier its impact map prints.
- The wrapper is frozen: only import paths, packaging and security updates of its
  dependencies change. Its test suite stays green and is the gate for the extraction.
- No "career-ops" in backend names, env vars, API text or images. The wrapper
  and `vendor/career-ops/` keep theirs.
- Only synthetic CVs and tokens in tests, examples and development.
- No secret in code, images, logs or commits. Compose passwords are dev-only and
  labelled so.
- Every new dependency is named in its PR, with a line on why it is needed.
- Removing or weakening a [Security baseline](../specs/2026-11-02-jobflow-hosted-product-design.md#security-baseline)
  item needs the owner.
- Existing Android keeps working: `career-ops-wrapper/contracts/` does not move
  in this phase.

## Decisions for the owner to check

These narrow the spec's phase 1 list. Each has the same reason: a piece with no
user yet is a guess.

| Spec item | This plan | Moved to |
| --- | --- | --- |
| All eight ports | Only `AuthVerifier`, plus the boundary test | Each port ships with its first adapter (phase 2 or 3) |
| MinIO in Compose | Left out | Phase 2, with `BlobStore` |
| All wrapper modules move | Only `address-guard`, `html-text`, `posting-fetcher`, `redaction` | `report-markdown` and the evaluation modules move in phase 3; `evaluation-prompt` needs a rewrite first because it reads the workspace |
| Scan diagnostics categories | Not moved | Phase 2 rewrites them for scan workers, because `scan-diagnostics.ts` depends on the wrapper's parser and engine types |
| Full schema | `users` table only | Each table ships with its feature |
| Metrics | Left out | Before release, with the alerts of the Monitoring row |

Builder's calls worth a look:

- **`jose` instead of `firebase-admin`:** Firebase documents verifying ID tokens
  with any JWT library. It needs far fewer dependencies, every failure can be
  tested offline, and the same adapter fits another OIDC provider, as the spec
  requires.
- **Prism for the mock:** no mock code to maintain; it returns the contract's
  own examples.
- **Separate database roles now:** the app role cannot change the schema. The
  baseline requires this at release, and adding it later is harder.
- **Wrapper dependency updates:** on 2026-11-02, `npm audit --omit=dev` reports 6
  high-severity issues in the wrapper's dependencies (`fastify`, `zod`, `js-yaml`,
  `find-my-way`, `fast-uri`, `nanoid`). The workspace has one lockfile and the
  backend must pass the audit, so task 2 updates them even though the wrapper is
  frozen.

## Review Focus

Each line has its test in the owning task.

1. The key endpoint is unreachable: a valid user gets 503 `AUTH_UNAVAILABLE`, not
   401, so the app does not sign them out. (Task 5)
2. A new user's first two requests arrive together: one `users` row, both
   succeed. (Task 5)
3. A client sends a fake `X-Forwarded-For` to dodge the IP rate limit: only the
   entries added by the configured number of trusted proxies count. (Task 5)
4. A malformed `Authorization` header (no scheme, empty token, wrong scheme,
   non-JWT): 401 envelope, never 500. (Task 5)
5. The database is down and the driver's error contains the connection string:
   neither the response nor the logs contain the password. (Task 4)

---

## Delivery order

| # | Task | PR tier (expected) | Depends on |
| --- | --- | --- | --- |
| 1 | Align rules, docs and review skill | M | none |
| 2 | Workspace and `@jobflow/safety` | L | 1 |
| 3 | Contract draft and mock | L | 2 |
| 4 | Backend skeleton, database, Compose, CI | L | 3 |
| 5 | Authentication, authorization, rate limits | L | 4 |
| 6 | Queue and worker | L | 4 |
| 7 | Vendor Career Ops | L | 4 |

Android has its own issue, written after task 3 (see
[Android](#android-not-in-these-tasks)).

### Task 1: Align rules, docs and review skill

The repo still describes the local-first model, and the review skill knows only
wrapper paths, so a backend PR would get the wrong risk areas and gates.

**Files:**
- Modify: `AGENTS.md`, `docs/system-architecture.md`, `docs/project-roadmap.md`,
  `docs/code-standards.md`, `docs/codebase-summary.md`, `README.md`,
  `docs/workflow/backend-delivery.md`, `.github/pull_request_template.md`
- Modify: `.claude/skills/review-change/scripts/impact-map.mjs`, `SKILL.md`,
  `references/reviewer-security.md`, `references/reviewer-impact.md`
- Test: `.claude/skills/review-change/scripts/impact-map.test.mjs`

**Interfaces:**
- Produces: impact-map components `backend`, `packages`, `hosted-contract`,
  `vendor`.

- [ ] **Step 1: Write failing impact-map tests**

Follow the fixture repo pattern in `impact-map.test.mjs`. One test per row:

| Changed path | Risk area | Tier | Gate printed |
| --- | --- | --- | --- |
| `backend/src/http/routes/x.ts` | `routes` | L | backend |
| `backend/src/http/auth-plugin.ts` | `security` | L | backend |
| `backend/src/server.ts`, `main.ts`, `http/*` | `routes` | L | backend |
| `backend/src/logging.ts`, `worker.ts`, `adapters/*` | `security` | L | backend |
| `backend/src/adapters/pg-*` | `database` | L | backend |
| `backend/migrations/0002_x.sql` | `database` | L | backend |
| `backend/src/config.ts` | `config` | L | backend |
| `backend/Dockerfile`, `compose.yaml`, `package-lock.json` | `config` | L | backend and wrapper |
| `backend/package.json`, `backend/.env.example` | `config` | L | backend |
| `packages/safety/package.json` | `config` | L | safety, backend and wrapper |
| `.dockerignore`, `.npmrc`, `tsconfig.base.json` | `config` | L | backend and wrapper |
| `.gitleaks.toml` | `security` | L | none |
| `docker/postgres-init.sql` | `database` | L | backend |
| `packages/safety/src/x.ts` | `security` | L | safety, backend and wrapper |
| `packages/contract/src/x.ts` | `contracts` | L | contract and backend |
| `contracts/examples/x.json` | `contracts` | L | contract and backend |
| `scripts/sync-career-ops.mjs` | `vendor` | L | the script's test |
| `vendor/career-ops/x.mjs` | `vendor` | L | none |
| `vendor/career-ops/modes/oferta.md` (a prompt, not documentation) | `vendor` | L | none |
| `career-ops-wrapper/contracts/x.json` | `contracts` | L | wrapper and Android (unchanged) |

Also assert: a `.md` under root `contracts/` is not docs-only, and symbol
references for a backend change list hits in `backend/` and `packages/`.

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test '.claude/skills/review-change/scripts/*.test.mjs'`
Expected: the new tests FAIL, except two regression tests that already pass: the
`.md` under root `contracts/`, and the `career-ops-wrapper/contracts/x.json` row.

- [ ] **Step 3: Extend `PATH_RISKS`, `RISK_CHECKS`, components, gates and grep paths in `impact-map.mjs`**

Gates: backend `npm test -w @jobflow/backend && npm run build -w @jobflow/backend`;
contract `npm test -w @jobflow/contract` and the backend gate; `packages/<name>` runs
`npm test -w @jobflow/<name>`, the backend gate and the wrapper gate. A gate prints only
when its package exists. Add `database`, `vendor` and `ci` to `MANDATORY_REVIEWER` with
`security`.
Exclude `vendor/` from `isDocumentation`.

`RISK_CHECKS` gets questions for the hosted backend, so its PRs stop asking about
the pairing token: is each new route behind default deny, can one user reach
another's data, can a token check be bypassed, is a migration safe to run twice,
does vendored code run or change a prompt.

- [ ] **Step 4: Scope the review role files**

`reviewer-security.md` and `reviewer-impact.md` cover `backend/` and `packages/`:
internet attackers, tokens, cross-user access, the database. The wrapper's LAN and
workspace threats stay, scoped to the wrapper.

- [ ] **Step 5: Run the skill tests**

Run: `node --test '.claude/skills/review-change/scripts/*.test.mjs'`
Expected: PASS.

- [ ] **Step 6: Update the docs**

- `AGENTS.md`: role is a hosted mobile product. Add `backend/`, `packages/`,
  `contracts/`, `vendor/` to the workspace table and commands; the wrapper row
  says "frozen development and self-host tool". Hard boundaries: Android calls
  the backend API; Firebase, AI and cloud SDKs only behind adapters; no generic
  shell endpoints stays. Keep the wrapper's boundaries, scoped to the wrapper.
- `docs/system-architecture.md`: hosted is the target, linking the spec; the
  current wrapper content moves under "Wrapper (frozen)".
- `docs/project-roadmap.md`: the spec's phases replace the remaining wrapper
  phases; mark the wrapper and Android-wrapper phases closed or superseded.
- `docs/workflow/backend-delivery.md`: covers `backend/` and `packages/` too.
- `docs/code-standards.md`: add Backend Standards (ports, routes, default deny,
  cross-user test per endpoint).
- `README.md`, `docs/codebase-summary.md`: match the layout above.
- `android/AGENTS.md` is left alone until the Android issue.

- [ ] **Step 7: Commit**

```bash
git commit -m "docs: align repo rules and the review skill with the hosted design"
```

### Task 2: Workspace and `@jobflow/safety`

**Files:**
- Create: `package.json`, `package-lock.json`, `tsconfig.base.json`,
  `packages/safety/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}`
- Move to `packages/safety/src/`: `career-ops-wrapper/src/evaluation/address-guard.ts`,
  `html-text.ts`, `posting-fetcher.ts`, `career-ops-wrapper/src/security/redaction.ts`
- Move to `packages/safety/test/`: `address-guard.test.ts`,
  `posting-fetcher.test.ts`, `redaction.test.ts`
- Delete: `career-ops-wrapper/package-lock.json`
- Modify: `career-ops-wrapper/package.json`, importers (`src/server.ts`,
  `src/security/report-markdown.ts`, `src/evaluation/evaluation-diagnostics.ts`,
  `src/services/evaluation-service.ts`, `test/evaluation-route.test.ts`)
- Modify: `.gitignore` (add `node_modules/`, `dist/`),
  `.github/workflows/wrapper.yml`, `review-skill.yml`,
  `.claude/skills/review-change/scripts/{impact-map,tests-prove-change}.mjs`,
  `tests-prove-change.test.mjs`, `SKILL.md`, `references/verifier.md`,
  `references/finding-format.md`, `career-ops-wrapper/README.md`

**Interfaces:**
- Produces: `@jobflow/safety` exports `isBlockedAddress`, `htmlToText`,
  `fetchPostingText`, `checkRedirect`, `PostingResult`, `PostingFailureReason`,
  `FetchPostingOptions`, the `POSTING_*` constants, `redactSensitiveText`,
  `RedactionOptions`. `tests-prove-change.mjs --package <dir>` (default
  `career-ops-wrapper`).

- [ ] **Step 1: Record the wrapper's baseline**

Run: `cd career-ops-wrapper && npm ci && npm test && npm ls typescript fastify zod vitest --depth=0`
Expected: PASS. Note the test count and versions for step 6.

- [ ] **Step 2: Create the root workspace**

Root `package.json`: `private: true`, `engines.node: ">=22.12"` (pg-boss's floor),
`workspaces: ["packages/*", "backend", "career-ops-wrapper"]`, scripts `build` and
`test` that run `--workspaces --if-present`, packages first. `tsconfig.base.json`
holds the wrapper's strict compiler options. The wrapper's own `tsconfig.json`
does not change.

Seed the lockfile so versions do not jump: copy the wrapper's `package-lock.json` to
the root, then run `npm install`.

- [ ] **Step 3: Move the four modules and their tests with `git mv`**

The package exports `./dist/index.js` with types and has no runtime dependencies.
Wrapper `pretest`, `prebuild` and `predev` scripts build `@jobflow/safety`,
so the wrapper's documented commands keep working.

- [ ] **Step 4: Write failing tests for two new redaction patterns**

```ts
expect(redactSensitiveText("Authorization: Bearer abc.def.ghi")).toBe("Authorization: Bearer [REDACTED]");
expect(redactSensitiveText("postgres://app:s3cret@db:5432/jobflow failed"))
  .toBe("postgres://app:[REDACTED]@db:5432/jobflow failed");
```

- [ ] **Step 5: Add the patterns to `redactSensitiveText` and run the package tests**

Run: `npm test -w @jobflow/safety`
Expected: PASS.

- [ ] **Step 6: Run the wrapper gate from a clean install**

Run: `rm -rf node_modules career-ops-wrapper/node_modules && npm ci && npm test -w career-ops-wrapper && npm run build -w career-ops-wrapper && npm ls typescript fastify zod vitest`
Expected: PASS. Same versions as step 1. The wrapper's test count falls by exactly
the moved tests, and those pass in the package.

- [ ] **Step 7: Update the vulnerable dependencies**

Run: `npm audit fix --omit=dev`, then repeat the step 6 test and build commands, then
`npm audit --omit=dev --audit-level=high`.
Expected: PASS and no high or critical finding. The PR lists each version change. If a
fix needs a major version, or a wrapper test fails because of it, stop and ask the owner.

- [ ] **Step 8: Update CI and the review skill**

- `wrapper.yml`: runs from the root, `cache-dependency-path: package-lock.json`,
  paths add `packages/safety/**`, `package.json`, `package-lock.json`,
  `tsconfig.base.json`.
- `review-skill.yml`: same lockfile path; `npm ci` at the root.
- `impact-map.mjs` `typescript()`: `createRequire` from the root `package.json`;
  the message says run `npm ci` at the root. `SKILL.md`: same.
- `tests-prove-change.mjs`: add `--package <dir>`, replacing the hard-coded `WRAPPER`
  paths. In its worktree it runs `npm ci --prefer-offline` and builds workspace
  packages before running tests. It must not symlink the root `node_modules`: npm's
  workspace links would then load `@jobflow/*` from the main checkout, not the
  worktree. Add a test with a workspace fixture that asserts which `dist` was loaded.
- `impact-map.mjs` prints one `tests-prove-change.mjs --package <dir>` command per
  changed package under "Layer 0 gates". `SKILL.md` says to run the commands the map
  prints, for every package, not only for wrapper source changes.
- `references/verifier.md`, `references/finding-format.md`: a verifier's worktree runs
  `npm ci --prefer-offline` and builds workspace packages, with no symlink.

Run: `node --test '.claude/skills/review-change/scripts/*.test.mjs'`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git commit -m "refactor: extract shared safety modules into an npm workspace package"
```

### Task 3: Contract draft and mock

Android can start from here. The draft covers the first release; later phases
may refine shapes through their own contract PRs.

**Files:**
- Create: `packages/contract/{package.json,tsconfig.json,vitest.config.ts}` (builds to
  `dist`, like `@jobflow/safety`),
  `packages/contract/src/{errors,identity,preferences,cv,jobs,feed,tracker,evaluations,billing,devices,index}.ts`,
  `packages/contract/src/operations.ts`,
  `packages/contract/scripts/{gen-openapi,mock-smoke}.ts`
- Create: `contracts/examples/**`, `contracts/error-codes.json`,
  `contracts/openapi.json` (generated), `contracts/README.md`
- Create: `compose.yaml` (service `mock` only for now), `.github/workflows/contract.yml`
- Test: `packages/contract/test/contract.test.ts`

**Interfaces:**
- Produces: `ErrorCodeSchema`, `ErrorResponseDtoSchema`, `HealthDtoSchema`,
  `MeDtoSchema` and one Zod schema per body below; `operations`, a table of
  `{ method, path, public, phase, request?, responses: { [status]: { schema, examples: string[] } } }`.

**Decided shapes.** Bearer auth on everything except health. Lists use
`{ items, nextCursor }`. Ids are opaque strings. The envelope stays
`{ error: { code, message, details? } }`.

| Method and path (under `/api/v1`) | Purpose | Phase |
| --- | --- | --- |
| `GET /health` (public) | `{ status: ok\|degraded, checks: { database: ok\|failed } }`; 503 when degraded | 1 |
| `GET /me` | `{ userId, isAnonymous, createdAt }`; creates the user on first call | 1 |
| `DELETE /me` | Delete the account, 202 | 3 |
| `GET`, `PUT /me/preferences` | Roles, keywords in and out, locations, remote policy, countries, minimum salary, seniority, optional `aim` text | 2 |
| `POST /me/cv/import` | Multipart, 5 MiB; returns `{ importId, markdown }` for review. `X-Integrity-Token` is documented as optional in this draft. Phase 3, which ships Play Integrity, makes it required through its contract PR. `restructure=true` uses AI, so it also needs Google sign-in and an entitlement or the trial (documented statuses: `SIGN_IN_REQUIRED`, `INTEGRITY_FAILED`, `ENTITLEMENT_REQUIRED`) | 2; integrity and AI 3 |
| `GET`, `PUT /me/cv` | Reviewed Markdown; `PUT` takes `{ importId?, markdown }` | 2 |
| `GET /feed` | Newest and best first: job summary, `reasons[]`, `trackerStatus?` | 2 |
| `GET /jobs/{jobId}` | Job fields from the spec's job index, plus `closed` | 2 |
| `PUT`, `DELETE /jobs/{jobId}/tracker` | `applied\|interview\|rejected\|skipped` | 2 |
| `GET /tracker` | Jobs the user has marked | 2 |
| `POST /companies` | `{ careersUrl }`; adds the company to the shared index | 2 |
| `PUT`, `DELETE /me/devices/{installationId}` | `{ fcmToken }` | 2 |
| `POST /jobs/{jobId}/evaluations` | 202 with an evaluation; needs `X-Integrity-Token` | 3 |
| `GET /evaluations/{id}` | Stage `queued\|fetching_job\|analyzing\|writing_report\|done\|failed`, score and report when done, labelled AI output | 3 |
| `GET /me/entitlement` | Plan, features, quota counters with reset time | 3 |
| `POST /me/purchases` | `{ productId, purchaseToken }` | 3 |

Error codes: `VALIDATION_ERROR` 400, `UNAUTHORIZED` 401, `SIGN_IN_REQUIRED` 403,
`ENTITLEMENT_REQUIRED` 403, `INTEGRITY_FAILED` 403, `NOT_FOUND` 404, `CONFLICT`
409, `PAYLOAD_TOO_LARGE` 413, `UNSUPPORTED_MEDIA_TYPE` 415, `CV_UNREADABLE` 422,
`RATE_LIMITED` 429,
`QUOTA_EXCEEDED` 429, `UNEXPECTED_ERROR` 500, `AUTH_UNAVAILABLE` 503,
`UNAVAILABLE` 503.

- [ ] **Step 1: Write the failing contract tests**

```ts
it("every example parses with the schema of its operation and status");
it("every operation has an example for every documented status");
it("every error example's code is in ErrorCodeSchema and in contracts/error-codes.json");
it("every operation except GET /health requires bearer auth");
it("contracts/openapi.json equals the generator's output"); // drift check
it("no example or schema description contains 'career-ops', an email outside example.com, or a home path");
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w @jobflow/contract`
Expected: FAIL.

- [ ] **Step 3: Write the schemas, `operations` and examples**

Use the wrapper's `src/contracts/` style. Examples are synthetic.

- [ ] **Step 4: Write `gen-openapi.ts`**

OpenAPI 3.1 built from `operations`, using `z.toJSONSchema`, with examples embedded
so Prism can serve them. Script: `npm run gen -w @jobflow/contract`.

- [ ] **Step 5: Run the tests**

Run: `npm run gen -w @jobflow/contract && npm test -w @jobflow/contract`
Expected: PASS.

- [ ] **Step 6: Add the `mock` service and smoke it**

`compose.yaml`: image `stoplight/prism:5` pinned to the digest at build time,
profile `mock`, command `mock -h 0.0.0.0 /contracts/openapi.json`, the file mounted
read-only, port `127.0.0.1:4010:4010`.

```bash
docker compose --profile mock up -d mock
curl -s -o /dev/null -w '%{http_code}\n' localhost:4010/api/v1/feed
curl -s -H 'Authorization: Bearer x' localhost:4010/api/v1/feed
curl -s -o /dev/null -w '%{http_code}\n' -H 'Authorization: Bearer x' -H 'Prefer: code=404' localhost:4010/api/v1/jobs/x
```

Expected: `401`; the feed example; `404`.

`mock-smoke.ts` (`npm run mock:smoke -w @jobflow/contract`) walks `operations` and
requests every documented status and example with `Prefer: code=` and
`Prefer: example=`, sending each operation's request example.

Run: `npm run mock:smoke -w @jobflow/contract`
Expected: every operation answers its documented status. If Prism cannot serve an
operation, such as the multipart import, record it in `contracts/README.md`.

Record the commands there too, including that the emulator reaches the mock at
`http://10.0.2.2:4010`.

- [ ] **Step 7: Add `contract.yml`**

Runs on `packages/contract/**`, `contracts/**`, root `package.json`, lockfile and
`tsconfig.base.json`: `npm ci`, then the tests.

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(contract): draft the hosted API contract with a mock server"
```

### Task 4: Backend skeleton, database, Compose, CI

**Files:**
- Create: `backend/{package.json,tsconfig.json,vitest.config.ts,Dockerfile,.env.example}`,
  `.dockerignore`, `docker/postgres-init.sql`
- Create: `backend/src/{config,logging,server,main}.ts`,
  `backend/src/http/{error-handler,errors}.ts`, `backend/src/http/routes/health.ts`,
  `backend/src/db/{pool,migrate}.ts`, `backend/migrations/0001_users.sql`
- Modify: `compose.yaml`
- Create: `.github/workflows/backend.yml`, `.github/workflows/secret-scan.yml`,
  `.gitleaks.toml`
- Modify: `docs/deployment-guide.md`
- Test: `backend/test/{config,errors,health,logging,db-roles,architecture}.test.ts`,
  `backend/test/support/{database,server}.ts`

**Interfaces:**
- Consumes: `@jobflow/contract`, `redactSensitiveText` from `@jobflow/safety`.
- Produces:

```ts
loadConfig(env: NodeJS.ProcessEnv): Config // throws naming the variable, never its value
createServer(deps: ServerDeps): Promise<FastifyInstance>
interface ServerDeps { config: Config; pool: Pool; logStream?: Writable;
  registerTestRoutes?: (scope: FastifyInstance) => void }
class ApiError extends Error { constructor(status: number, code: ErrorCode, message: string, details?: Record<string, unknown>) }
withTestDatabase(): Promise<{ appUrl: string; ownerUrl: string; drop(): Promise<void> }> // test support
```

Env: `JOBFLOW_ENV` (`development|test|production`), `PORT`, `DATABASE_URL` (app
role), `DATABASE_MIGRATION_URL` (owner role, migrate step only), `FIREBASE_PROJECT_ID`,
`TRUST_PROXY` (number of trusted proxy hops, an integer, default `0`; never `true`,
which would trust a client's own `X-Forwarded-For`). Tests also read
`TEST_DATABASE_ADMIN_URL`, which `withTestDatabase` uses to create databases.

`@jobflow/backend` has `pretest`, `prebuild` and `predev` scripts that build
`@jobflow/safety` and `@jobflow/contract`.

`users`: `id uuid primary key default gen_random_uuid()`, `auth_subject text not null
unique`, `created_at timestamptz not null default now()`, `deleted_at timestamptz`.

- [ ] **Step 1: Add the `postgres` service and the role script**

`compose.yaml`: `postgres` (`pgvector/pgvector:pg17`, pinned by digest),
`127.0.0.1:5432`. `docker/postgres-init.sql` creates the roles `jobflow_owner` (with
`CREATEDB`, for test databases) and `jobflow_app`, with dev-only passwords, and
`CREATE DATABASE jobflow OWNER jobflow_owner`. Since PostgreSQL 15 only the database
owner can create objects in `public`, so a deployed database needs the same owner.
Record that in `docs/deployment-guide.md`.

Run: `docker compose up -d postgres && docker compose exec postgres pg_isready`
Expected: accepting connections.

- [ ] **Step 2: Write the failing tests**

```ts
// config
it("names a missing variable in the error"); it("never includes a value in the error");
it.each(["true", "yes", "-1"])("rejects TRUST_PROXY=%s");
// errors
it("ApiError maps to its status and envelope");
it("a Zod error maps to 400 VALIDATION_ERROR with field paths, no input values");
it("an unknown error maps to 500 UNEXPECTED_ERROR with a fixed message and no stack");
it("an oversized body maps to 413 PAYLOAD_TOO_LARGE");  // via registerTestRoutes
it("a malformed JSON body maps to 400 VALIDATION_ERROR");
it("an unsupported content type maps to 415 UNSUPPORTED_MEDIA_TYPE");
it("an unknown path returns the 404 NOT_FOUND envelope");
// health
it("returns 200 ok when the database answers");
it("returns 503 degraded when the database fails, within 2 s");
// Review Focus 5: pool stub rejects with an error containing postgres://app:s3cret@db/x
it("a database error's connection string is in neither the response nor the log");
// logging
it("a request's Authorization header and body are not logged");
it("a log line has request id, route, status and duration");
// db-roles, against real PostgreSQL
it("migrate applies 0001 and running it twice is a no-op");
it("the app role can read and write users");
it("the app role cannot create a table");
// architecture
it("the import check flags a sample source that imports pg"); // so the checks below cannot pass by finding nothing
it("backend/src/core imports nothing but core/, zod and node: modules");
it("backend/src/http imports no file from backend/src/adapters");
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npm test -w @jobflow/backend`
Expected: FAIL.

- [ ] **Step 4: Implement `config`, `http/errors`, `http/error-handler`, `logging`, `server`**

Fastify `bodyLimit` 1 MiB, `requestTimeout` 30 s. The error handler maps `ApiError` and
Zod errors, then Fastify client errors by their `statusCode`, then falls back to the
fixed 500. `setNotFoundHandler` returns the envelope. Logging: pino through Fastify
with request and response serializers that keep only id, method, route, status and
duration, and an error serializer that runs `redactSensitiveText`.

- [ ] **Step 5: Implement `db/pool`, `db/migrate`, the migration and `routes/health`**

`migrate` uses `node-pg-migrate` with `DATABASE_MIGRATION_URL`. It is a separate
command, never run at API start. `0001_users.sql` also grants `jobflow_app` what it
needs. Grants belong in migrations because default privileges are per database, so
an init script would not reach test or deployed databases.

- [ ] **Step 6: Run the tests**

Run: `npm test -w @jobflow/backend && npm run build -w @jobflow/backend`
Expected: PASS.

- [ ] **Step 7: Add the Dockerfile and Compose services**

- Multi-stage, from the repo root; `node:22-slim` pinned by digest; `npm ci` with
  the three workspaces; `npm prune --omit=dev`; `USER node`; `CMD node backend/dist/main.js`.
- `compose.yaml`: add `migrate` (one-shot) and `api`. All published ports bind to
  `127.0.0.1`. The worker joins in task 6.

```bash
docker compose up -d --build api
curl -s localhost:8080/api/v1/health
docker compose run --rm --entrypoint id api -u
```

Expected: `{"status":"ok","checks":{"database":"ok"}}`; a non-zero uid.

- [ ] **Step 8: Add `backend.yml`**

Paths: `backend/**`, `packages/**`, `contracts/**`, `vendor/**`, `scripts/**`,
`docker/**`, `.dockerignore`, `compose.yaml`, `tsconfig.base.json`, root `package.json`
and lockfile, and the workflow file. Jobs: a PostgreSQL service container; after checkout, a step that
runs `docker/postgres-init.sql` with `psql`, because service containers start before
checkout and cannot mount it; `npm ci`; backend tests and build;
`npm audit --omit=dev --audit-level=high`; Docker build; image scan with Trivy pinned
by commit SHA or digest. A HIGH or CRITICAL fixable finding fails the job.

- [ ] **Step 9: Add `secret-scan.yml`**

Gitleaks, pinned the same way, on every PR and push to `main` with no path filter, so
a secret in any file is caught. A finding fails the job. It scans each PR's commits.
Scan the full history once when adding it, and report the result in the PR.

`.gitleaks.toml` allowlists only by exact path or value: synthetic test values, the
dev-only Compose passwords and `android/debug.keystore.base64`. A new entry needs a
reason in its PR. Anything that looks like a real secret goes to the owner, not the
allowlist.

- [ ] **Step 10: Commit**

```bash
git commit -m "feat(backend): add the API skeleton, database, Compose and CI"
```

### Task 5: Authentication, authorization, rate limits

**Files:**
- Create: `backend/src/core/{identity,ports}.ts`,
  `backend/src/adapters/{oidc-auth-verifier,pg-user-repository}.ts`,
  `backend/src/http/{auth-plugin,rate-limits}.ts`, `backend/src/http/routes/me.ts`
- Modify: `backend/src/{server,main}.ts`, `backend/test/{errors,logging}.test.ts`,
  `backend/test/support/server.ts`
- Test: `backend/test/{oidc-auth-verifier,auth-plugin,me,rate-limits}.test.ts`,
  `backend/test/support/cross-user.ts`

**Interfaces:**

```ts
// core
type UserId = string & { readonly __brand: "UserId" };
interface VerifiedIdentity { subject: string; isAnonymous: boolean }
interface AuthVerifier { verify(token: string): Promise<VerifiedIdentity> } // throws InvalidTokenError or AuthUnavailableError
interface UserRepository { resolve(subject: string): Promise<{ id: UserId; createdAt: Date; deleted: boolean }> }
// adapter
createOidcAuthVerifier(opts: { issuer: string; audience: string; keys: JWTVerifyGetKey }): AuthVerifier
createFirebaseAuthVerifier(projectId: string): AuthVerifier
// server: ServerDeps gains `authVerifier: AuthVerifier` and `users: UserRepository`
// http
declare module "fastify" { interface FastifyRequest { auth: { userId: UserId; isAnonymous: boolean } } }
// A route is public only with `config: { public: true }`.
// test support: asserts B's token cannot read or change A's resource.
expectCrossUserDenied(opts: { server; seed(as: TestUser): Promise<string>; request(resourceId: string, as: TestUser): InjectOptions })
```

Firebase values: issuer `https://securetoken.google.com/<projectId>`, audience
`<projectId>`, keys from
`https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`,
algorithm RS256 only. `isAnonymous` is `firebase.sign_in_provider === "anonymous"`.

Order: IP limit, then auth, both at `onRequest`, so no body is parsed for a caller
without a valid token; then the user limit at `preHandler`.

Limits: 300 requests a minute per IP, before auth; 120 a minute per user, after
auth. Both in memory for now, so several instances multiply them; a shared store
comes when a second instance does.

- [ ] **Step 1: Write the failing verifier tests**

Sign with a local RSA key and a local JWK set; no network.

```ts
it("accepts a valid token and returns its subject");
it("marks a firebase anonymous token isAnonymous");
it.each(["wrong issuer", "wrong audience", "expired", "issued in the future", "empty subject",
         "alg none", "HS256 signed with the public key", "unknown kid", "bad signature", "not a JWT"])
  ("rejects %s with InvalidTokenError");
// Review Focus 1
it("throws AuthUnavailableError when the key endpoint fails");
```

- [ ] **Step 2: Write the failing plugin, `/me` and limit tests**

```ts
// default deny: collects routes through onRoute
it("the only public route is GET /api/v1/health");
it("every other route answers 401 without a token");  // includes a registerTestRoutes route with no auth option
it("a POST with no token and a malformed body answers 401, not a parse error");
// Review Focus 4
it.each(["", "Bearer", "Bearer ", "Basic abc", "abc", "Bearer not-a-jwt"])("Authorization %j gets the 401 envelope");
// Review Focus 1
it("AuthUnavailableError gets 503 AUTH_UNAVAILABLE");
// me
it("creates the user on first call and returns the same userId afterwards");
it("anonymous and signed-in tokens report isAnonymous correctly");
it("returns only the caller's user");   // two subjects, two ids
it("a deleted user gets 401, and the row is not revived");
// Review Focus 2, real PostgreSQL
it("two parallel first calls create one row and both succeed");
// Review Focus 3
it("ignores X-Forwarded-For when TRUST_PROXY is 0");
it("with TRUST_PROXY=1 and X-Forwarded-For '6.6.6.6, 9.9.9.9', the client IP is 9.9.9.9");
it("over the IP limit returns 429 RATE_LIMITED in the envelope, even with no token");
it("over the user limit returns 429 for that user, not for another user on the same IP");
```

`expectCrossUserDenied` gets its own test through a `registerTestRoutes` resource
owned by a user. Later phases use it on every endpoint with user data.

Task 4's error and logging tests use `registerTestRoutes` routes, which now require
auth. They send a token accepted by a stub `AuthVerifier`. Test routes stay behind
auth, because the default-deny test depends on that.

- [ ] **Step 3: Run them to verify they fail**

Run: `npm test -w @jobflow/backend`
Expected: FAIL.

- [ ] **Step 4: Implement the verifier, repository, plugin, limits and `/me`**

- The plugin adds `onRoute` so a route without `config.public` gets the auth
  `onRequest` hook. Any other failure from the repository maps to 503 `UNAVAILABLE`.
- `resolve` is one statement: `INSERT … ON CONFLICT (auth_subject) DO UPDATE SET
  auth_subject = EXCLUDED.auth_subject RETURNING id, created_at, deleted_at`.
- `req.auth.userId` is the only source of a user id; no route reads one from the
  path, query or body for authorization.
- Limits: `@fastify/rate-limit` registered twice with separate name spaces: IP at
  `onRequest`, user at `preHandler`, with `errorResponseBuilder` returning the
  envelope. Fastify's `trustProxy` is the hop count from config, or `false` at `0`.

- [ ] **Step 5: Run the tests**

Run: `npm test -w @jobflow/backend && npm run build -w @jobflow/backend`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(backend): verify tokens, deny by default and limit request rates"
```

A smoke with a real Firebase token waits for the owner's Firebase project. Note
this in the PR. The key URL was reachable and returned a JWK set on 2026-11-02.

### Task 6: Queue and worker

**Files:**
- Create: `backend/src/core/jobs.ts`, `backend/src/adapters/pg-boss-queue.ts`,
  `backend/src/worker.ts`
- Modify: `backend/src/db/migrate.ts`, `compose.yaml`
- Test: `backend/test/queue.test.ts`

**Interfaces:**

```ts
// core
interface JobDefinition<T> { name: string; schema: ZodType<T> }
interface JobQueue {
  enqueue<T>(job: JobDefinition<T>, payload: T, opts?: { idempotencyKey?: string }): Promise<void>;
}
type JobHandler<T> = (payload: T, signal: AbortSignal) => Promise<void>;
// adapter
createPgBossQueue(url: string): JobQueue & {
  register<T>(job: JobDefinition<T>, handler: JobHandler<T>): Promise<void>;
  stop(): Promise<void>;
}
```

Defaults: `retryLimit` 3, `retryBackoff` true, `expireInSeconds` 300.

- [ ] **Step 1: Write the failing tests, against real PostgreSQL with the app role**

```ts
it("a registered handler receives an enqueued payload");
it("a failing handler is retried and then succeeds");
it("a payload that fails its schema is not enqueued");
it("the same idempotencyKey enqueues once");
it("stop waits for a running handler to finish");
it("job payloads do not appear in logs");
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test -w @jobflow/backend -- queue`
Expected: FAIL.

- [ ] **Step 3: Implement the adapter, migrate step and `worker.ts`**

Check pg-boss 12's docs for current names (`createQueue`, `work`, the `migrate`
option). pg-boss installs its own schema and creates queues, so **run both in the
migrate step with the owner role**, grant `jobflow_app` what it needs on that schema
there, and start the API and worker with the app role and migration off. If pg-boss 12 needs DDL at run time, give it a role that owns only
its schema, keep "app role cannot create a table" true for the `public` schema, and
say so in the PR. `worker.ts` registers one `system.heartbeat` job on a schedule and
stops on SIGTERM.

- [ ] **Step 4: Run the tests**

Run: `npm test -w @jobflow/backend && npm run build -w @jobflow/backend`
Expected: PASS, including `db-roles`.

- [ ] **Step 5: Add `worker` to Compose and smoke it**

```bash
docker compose up -d --build worker
docker compose logs worker | tail -5
```

Expected: the heartbeat job runs; no error lines. `docker compose kill -s SIGTERM
worker` exits cleanly.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(backend): add the queue and the worker process"
```

### Task 7: Vendor Career Ops

Treat upstream as untrusted input: copy and diff only. Nothing vendored runs in this
phase, and no backend file imports it. Upstream has 146 files under `providers/`,
many of which scrape sites whose terms are unchecked, so this is an allowlist.

**Files:**
- Create: `vendor/career-ops/{LICENSE,README.md,UPSTREAM.json}`, the allowlisted files
- Create: `scripts/sync-career-ops.mjs`, `scripts/sync-career-ops.test.mjs`
- Modify: `README.md`, `.github/workflows/backend.yml`

**Interfaces:**
- Produces: `UPSTREAM.json`: `{ repository, commit, entries: string[], files: string[] }`.
  `node scripts/sync-career-ops.mjs [--commit <sha>] [--write | --check]`. With no mode
  it prints the diff against upstream and changes nothing. `--check` compares vendored
  files with `UPSTREAM.json`'s pinned commit and exits non-zero on any difference.

Allowlist entries:

- `modes/_shared.md`, `modes/oferta.md`, `modes/oferta-signals/*`
- `providers/` for the spec's list: `greenhouse`, `lever`, `ashby`, `workable`,
  `workday`, `smartrecruiters`, `recruitee`, `remoteok`, `remotive`, `workingnomads`,
  `glints`, `jobstreet`, `arbeitsagentur`, `solidjobs`, plus `ADDING_A_PROVIDER.md`
- `templates/portals.example.yml`, the seed company list named by the spec
- `LICENSE`, plus `TRADEMARK.md` for reference

Pin the commit current at build time (`6825dc6` on 2026-11-02).

- [ ] **Step 1: Write the failing script tests, against a local fixture git repo**

```ts
it("dry run prints added, changed and removed files and writes nothing");
it("--write copies only allowlisted entries and their relative imports, and updates commit and files");
it("fails when a vendored file imports a relative path that is not vendored");
it("refuses a path that leaves vendor/career-ops");
it("--check exits non-zero when a vendored file was edited locally");
it("--check exits 0 when upstream has moved past the pinned commit");
it("runs no upstream code"); // the fixture has a script that writes a marker file when executed
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test scripts/sync-career-ops.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement the script**

Clone into a temp dir with `git clone --no-checkout` and read with `git show`. Install
nothing and execute nothing from the clone. Follow relative imports statically to find
helpers (`providers/_http.mjs` and so on).

- [ ] **Step 4: Run the tests, then vendor**

Run: `node --test scripts/sync-career-ops.test.mjs && node scripts/sync-career-ops.mjs --write`
Expected: PASS; `vendor/career-ops/` holds only allowlisted files and their helpers.

- [ ] **Step 5: Write `vendor/career-ops/README.md` and check the rules**

The README gives the source, license, commit, the fact that each provider needs a
terms check before it ships (spec, Legal and policy notes), and that edits go through
the script. Add to `backend.yml` the script's test and `--check`. It fails on a local
edit, not on upstream drift, because updates are deliberate.

Run: `git grep -n 'vendor/career-ops' -- backend packages`
Expected: no match.

- [ ] **Step 6: Commit**

```bash
git commit -m "chore: vendor the Career Ops parts the hosted backend reuses"
```

## Android (not in these tasks)

The owner may do Android, so it is one separate issue, opened after task 3:

- Point `ContractFixtures.kt` and `android.yml` at root `contracts/`, and mirror the
  new DTOs, in one PR, so contract tests never break.
- Replace the `CAREER_OPS_*` build config with a hosted base URL (`dev` uses the mock
  at `http://10.0.2.2:4010`, then local `api` at `:8080`).
- Auth layer: Firebase anonymous, then Google with account linking; a bearer token
  interceptor replacing `PairingTokenInterceptor`. Needs the owner's Firebase project.
- Room for the local cache.
- Update `android/AGENTS.md`.

## Phase 1 is done when

- [ ] `docker compose up` runs PostgreSQL, migrate, API and worker from a clean
      checkout, and `/api/v1/health` reports ok.
- [ ] `GET /api/v1/me` works with a test-signed token in tests, and with a real
      Firebase token once the owner's project exists.
- [ ] The mock serves every contract example.
- [ ] The wrapper's suite passes from the workspace, and existing Android CI passes.
- [ ] Baseline rows marked phase 1 are in place: authentication, authorization,
      input, resource limits, secrets, supply chain.
- [ ] The roadmap shows phase 1 closed, with a follow-up plan for phase 2.
