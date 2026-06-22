## Deferred from: code review of 1-1-scaffold-wrapper-backend-api-foundation.md (2026-06-20)

- Screenshot test no longer exercises production UI [app/src/test/java/com/example/GreetingScreenshotTest.kt:26] — pre-existing Android test drift. The stale screenshot test should be replaced with coverage for a current production Compose surface, such as the Arena screen or a stable production component.

## Deferred from: code review of 1-2-validate-wrapper-runtime-configuration-and-workspace-boundary.md (2026-06-21)

- Future file APIs need validate-and-open helpers to avoid symlink time-of-check/time-of-use races [career-ops-wrapper/src/security/path-guard.ts:12]. Story 1.2 creates reusable path containment utilities but intentionally does not wire CV/Profile/Portal reads or artifact serving yet; later file adapter stories should validate and open/read/write in one guarded operation.

## Deferred from: correct course of Career Ops execution strategy (2026-06-21)

- Native AI CLI slash-command automation for Antigravity/Claude/Gemini/Codex/OpenCode/Qwen is deferred until a dedicated headless/non-interactive spike proves a stable command interface, process lifecycle model, token/cost behavior, and log redaction boundary.
- Standalone API-key evaluator scripts such as `gemini-eval.mjs` are deferred as optional provider mode. Any future promotion must include explicit budget/cost controls, provider API-key redaction, retry limits, and clear separation from the zero-token MVP scan path.

## Deferred from: code review of 1-3-expose-health-and-workspace-readiness-api.md (2026-06-21)

- Public health endpoint performs workspace write probes [career-ops-wrapper/src/workspace/workspace-health.ts:42] — pre-existing Story 1.2 behavior from workspace-writable readiness. Revisit with a dedicated design decision before changing the public health contract to read-only, cached, or protected readiness.
