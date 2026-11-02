# JobFlow Agent Instructions

Scope: this file governs the full `jobflow/` workspace. Subprojects may add
more specific instructions; the narrower file wins for local implementation
details.

## Role

Act as a senior maintainer for a hosted mobile product. The design is
`docs/superpowers/specs/2026-11-02-jobflow-hosted-product-design.md`. Preserve the
boundary between the Android app and the API, keep changes small, and verify
with the cheapest relevant check.

## Read Order

1. `README.md`
2. `docs/codebase-summary.md`
3. `docs/system-architecture.md`
4. `docs/code-standards.md`
5. `docs/superpowers/specs/2026-11-02-jobflow-hosted-product-design.md`
6. Subproject instructions such as `android/AGENTS.md`

## Workspace

| Path | Responsibility |
| --- | --- |
| `android/` | Native Android client |
| `backend/` | Hosted API and workers (being built, see `docs/superpowers/plans/2026-11-02-hosted-backend-phase-1.md`) |
| `packages/` | Shared TypeScript packages (being built) |
| `contracts/` | Hosted API contract and examples (being built) |
| `vendor/career-ops/` | Vendored Career Ops parts (being built) |
| `career-ops-wrapper/` | Frozen development and self-host tool: a local Fastify API over Career Ops workspace files/scripts |
| `docs/` | Product and engineering source of truth |
| `_bmad-output/` | Planning artifacts; reference only |

## Commands

Android:

```bash
cd android
./gradlew assembleDevDebug testDevDebugUnitTest lintDevDebug detekt ktlintCheck
```

Wrapper:

```bash
cd career-ops-wrapper
npm test
npm run build
```

Local integration:

```bash
cd career-ops-wrapper
npm run dev -- --workspace /path/to/career-ops
curl http://127.0.0.1:3000/api/v1/health
```

Backend, shared packages and hosted contract, from the repo root. These work
once tasks 2 to 4 of the phase 1 plan land. The `review-change` impact map prints
the ones a change needs.

```bash
npm test -w @jobflow/safety
npm test -w @jobflow/contract
npm test -w @jobflow/backend
npm run build -w @jobflow/backend
```

## Hard Boundaries

- Android calls an API (the wrapper today, the hosted backend after its
  migration); it must not read/write Career Ops workspace files directly.
- In the backend, core code reaches Firebase, cloud and AI vendors only through
  adapters.
- Every backend route is denied by default, and user data is scoped to the
  authenticated user.
- Removing or weakening an item of the design's Security baseline needs the
  owner.
- AI development agents get no production secrets and no direct access to
  production data. Subscription AI CLIs never serve real users.
- The wrapper owns workspace path containment, safe file IO, command allowlists,
  redaction, and local pairing token enforcement for its own workspace.
- Do not expose generic shell execution endpoints.
- Do not use "career-ops" in the product's name, store listing or branding.
- Do not commit secrets, tokens, release keystores, local workspace paths, or
  real CV/profile content.
- Do not edit generated/build outputs such as `android/build/`,
  `android/app/build/`, `backend/dist/`, `packages/*/dist/`, or
  `career-ops-wrapper/dist/`.

## Workflow

- Inspect `git status --short` before editing.
- Search with `rg` before adding patterns.
- Keep diffs scoped to the request.
- Respect dirty worktrees; never revert user changes unless explicitly asked.
- Update docs when architecture, commands, contracts, or boundaries change.
- Before opening a PR, run the multi-layer review skill
  `.claude/skills/review-change/` (backend, packages, wrapper, contracts and
  Android). The writer
  orchestrates; fresh reviewers find, verifiers reproduce, the writer fixes.
- Final response must name changed files and checks run.

## Branches, Commits, PRs

- Branches: `<type>/<kebab-case-description>` (`feature`, `bugfix`, `hotfix`,
  `refactor`, `design`, `doc`).
- Conventional Commits; no co-author trailers or tool attribution in commits
  or PR descriptions.
- `main` is protected; land changes through PRs merged with a merge commit.
- Backend delivery steps and owner decisions:
  `docs/workflow/backend-delivery.md`.
