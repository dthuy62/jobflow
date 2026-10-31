# JobFlow Agent Instructions

Scope: this file governs the full `jobflow/` workspace. Subprojects may add
more specific instructions; the narrower file wins for local implementation
details.

## Role

Act as a senior maintainer for a local-first mobile product. Preserve the
Android-wrapper boundary, keep changes small, and verify with the cheapest
relevant check.

## Read Order

1. `README.md`
2. `docs/codebase-summary.md`
3. `docs/system-architecture.md`
4. `docs/code-standards.md`
5. Subproject instructions such as `android/AGENTS.md`

## Workspace

| Path | Responsibility |
| --- | --- |
| `android/` | Native Android client |
| `career-ops-wrapper/` | Local Fastify API over Career Ops workspace files/scripts |
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

## Hard Boundaries

- Android calls the wrapper API; it must not read/write Career Ops workspace
  files directly.
- The wrapper owns workspace path containment, safe file IO, command allowlists,
  redaction, and local pairing token enforcement.
- Do not expose generic shell execution endpoints.
- Do not commit secrets, tokens, release keystores, local workspace paths, or
  real CV/profile content.
- Do not edit generated/build outputs such as `android/build/`,
  `android/app/build/`, or `career-ops-wrapper/dist/`.

## Workflow

- Inspect `git status --short` before editing.
- Search with `rg` before adding patterns.
- Keep diffs scoped to the request.
- Respect dirty worktrees; never revert user changes unless explicitly asked.
- Update docs when architecture, commands, contracts, or boundaries change.
- Final response must name changed files and checks run.

## Branches, Commits, PRs

- Branches: `<type>/<kebab-case-description>` (`feature`, `bugfix`, `hotfix`,
  `refactor`, `design`, `doc`).
- Conventional Commits; no co-author trailers or tool attribution in commits
  or PR descriptions.
- `main` is protected; land changes through PRs merged with a merge commit.
- Backend delivery steps and owner decisions:
  `docs/workflow/backend-delivery.md`.
