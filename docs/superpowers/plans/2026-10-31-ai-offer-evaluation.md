# AI Offer Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the app start an AI evaluation of one offer; the wrapper runs a
tool-less `claude -p`, validates its JSON and writes the report and tracker row.

**Architecture:** A new async operation shaped like scan runs (store, service,
routes). The model is a pure function: the wrapper fetches the posting
(SSRF-guarded), builds the prompt, spawns the CLI with a fixed argv, an env
allowlist and an empty cwd, validates the output with Zod, then writes through
Career Ops's own `reserve-report-num.mjs` and `merge-tracker.mjs`.

**Tech Stack:** Node 22+/TypeScript, Fastify 5, Zod 4, Vitest. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-31-ai-offer-evaluation-design.md`
(approved 2026-10-31, all eight owner decisions as recommended).

## Global Constraints

- Env: `CAREER_OPS_EVALUATION_PROVIDER` (`claude` only; unset = disabled),
  `CAREER_OPS_EVALUATION_TIMEOUT_MS` (60000–3600000, default 900000),
  `CAREER_OPS_EVALUATION_CLI` (absolute path; default: resolve `claude` on `PATH`).
- Evaluation ID: `^eval_\d{14}_[a-f0-9]{6}$`. History 20, in memory.
- Child env allowlist: `HOME USER LOGNAME PATH SHELL TMPDIR LANG LC_ALL LC_CTYPE`
  plus `TERM=dumb`, `NO_COLOR=1` (plus `CAREER_OPS_ADDITIONS` for merge-tracker only).
- Caps: CLI stdout 1 MiB whole; stderr 256 KiB tail; posting 2 MiB body,
  60 000 chars text, min 500 chars; rubric/cv files 256 KiB; optional files
  64 KiB; report body 200–120 000 chars; note ≤160; warnings ≤10.
- Posting fetch: 20 s total, ≤5 redirects, only `http→https` scheme change,
  ports 80/443/none, content types `text/html`, `text/plain`, `application/json`.
- New API error code `EVALUATION_ALREADY_RUNNING` → 409.
- No CLI output, prompt, posting, CV or path ever reaches a client or a log.
- Commits: Conventional Commits, no Co-Authored-By or tool attribution.

## Review Focus

- Offer URL that is an IP literal or numeric host (`http://2130706433/`) — must be blocked before any connection (Task 4).
- Valid JSON in `structured_output` vs JSON text in `result` — both must parse; the live CLI may use either (Task 6).
- `reserve-report-num.mjs` leaving a sentinel after a failure — the real report must never be hidden (Task 7).
- Company/role with `|` or newlines from scan data — tracker row stays one well-formed line (Task 7).
- Many concurrent public `GET /health` calls — exactly one `auth status` spawn (Task 8).

---

### Task 1: Config

**Files:** Modify `src/config/env.ts`, `src/config/runtime-config.ts`; Test `test/config.test.ts`.

**Interfaces — Produces:**
- `RuntimeConfig.evaluation?: { provider: "claude"; timeoutMs: number; cliPath?: string }`
- `DEFAULT_EVALUATION_TIMEOUT_MS = 900_000`
- `parseEvaluationProvider(value: string): "claude"`, `parseEvaluationTimeoutMs(value: string): number`

- [ ] Tests: provider `claude` → `config.evaluation.provider === "claude"`; `gemini`/`x` throws `CAREER_OPS_EVALUATION_PROVIDER must be "claude".`; timeout `59999` throws; relative CLI path throws `CAREER_OPS_EVALUATION_CLI must be an absolute path.`; unset provider → `config.evaluation` undefined even if timeout set.
- [ ] Implement, run `npx vitest run test/config.test.ts`, commit `feat(wrapper): evaluation config`.

### Task 2: Contracts and error code

**Files:** Create `src/contracts/evaluation-contract.ts`; modify `src/contracts/index.ts`, `src/contracts/health-contract.ts`, `src/contracts/error-contract.ts`, `src/errors/error-mapper.ts`, `contracts/error-codes.json`, `contracts/examples/*`, Android `core/common/ApiErrorCode.kt`, `ui/components/UiError.kt` (if it maps codes), `test/.../ApiErrorCodeContractTest.kt` fixtures.

**Interfaces — Produces:**
- `EvaluationDtoSchema`, `EvaluationDto`, `StartEvaluationRequestDtoSchema` (`{ offerId: OpaqueId }`, strict).
- `EvaluationStatusSchema` = `pending|running|succeeded|failed|cancelled`; `EvaluationStageSchema` = `queued|fetching-posting|evaluating|writing|completed|failed|cancelled`.
- `EVALUATION_FAILURE_CODES` = `POSTING_UNAVAILABLE CLI_NOT_LOGGED_IN CLI_LIMIT_REACHED COMMAND_TIMEOUT COMMAND_FAILED SPAWN_FAILED OUTPUT_INVALID WRITE_FAILED CANCELLED`.
- `EvaluationModelOutputSchema` (`score` 0–5, `legitimacy` enum, `note` 1–160, `reportMarkdown` 200–120000, strict) and `EVALUATION_OUTPUT_JSON_SCHEMA` (the spec's JSON Schema object).
- Health: `careerOps.aiCliRequired: boolean`, `careerOps.evaluator: { status: ready|notReady|disabled, provider: "claude"|null, missingRequirements: string[] }`, `capabilities.aiEvaluation: boolean`.
- Examples: `evaluation.running.json`, `evaluation.succeeded.json`, `evaluation.failed.json`, `errors/evaluation-not-ready.json`, `errors/evaluation-already-running.json`; updated `health.ready.json`, `health.not-ready.json`.

- [ ] Tests: `contract-examples.test.ts` parses each new example; error mapper maps `EVALUATION_ALREADY_RUNNING` → 409; model output rejects extra keys, score 7, short report.
- [ ] Android: add enum entry; run `./gradlew testDevDebugUnitTest` for `ApiErrorCodeContractTest`.
- [ ] Commit `feat(wrapper): evaluation contracts and EVALUATION_ALREADY_RUNNING`.

### Task 3: Shared bounded process runner

**Files:** Create `src/process/bounded-process.ts`; modify `src/career-ops-engine/career-ops-engine-adapter.ts`; Test `test/bounded-process.test.ts` (scan adapter tests stay green).

**Interfaces — Produces:**
```ts
runBoundedProcess(input: {
  command: string; args: readonly string[]; cwd: string; env: NodeJS.ProcessEnv;
  timeoutMs: number; signal?: AbortSignal; stdin?: string;
  stdoutMode?: { kind: "tail"; maxChars: number } | { kind: "whole"; maxChars: number };
  killGraceMs?: number;
}): Promise<ProcessResult>
interface ProcessResult { exitCode; signal; timedOut; spawnFailed; outputTooLarge: boolean; stdout; stderr }
```
Process group kill, live-process set killed on exit, pipe-drain logic moved verbatim from the scan adapter.

- [ ] Tests: stdin echo round-trips; `whole` mode over cap → `outputTooLarge` and child killed; timeout kills a grandchild; abort kills.
- [ ] Refactor scan adapter onto it; `npx vitest run` all green; commit `refactor(wrapper): extract bounded process runner`.

### Task 4: Posting fetcher

**Files:** Create `src/evaluation/posting-fetcher.ts`, `src/evaluation/address-guard.ts`, `src/evaluation/html-text.ts`; Tests `test/address-guard.test.ts`, `test/posting-fetcher.test.ts`.

**Interfaces — Produces:**
- `isBlockedAddress(ip: string): boolean`
- `fetchPostingText(url: string, options?: { lookup?: LookupFunction; timeoutMs?: number }): Promise<PostingResult>`; `PostingResult = { ok: true; text: string; truncated: boolean } | { ok: false; reason: PostingFailureReason }`; reasons: `blocked-address|bad-url|http-status|content-type|too-large|too-short|network|timeout|redirect`.
- `htmlToText(html: string): string`

- [ ] Tests (address guard): blocked `127.0.0.1 10.0.0.1 172.16.0.1 192.168.1.1 169.254.169.254 100.64.0.1 0.0.0.0 255.255.255.255 224.0.0.1 ::1 :: fd00::1 fe80::1 ::ffff:127.0.0.1 ::ffff:7f00:1`; allowed `8.8.8.8 2606:4700::1`.
- [ ] Tests (fetcher, local HTTP server, injected lookup mapping `public.test`→`127.0.0.1` and test allow): ok HTML → text without `<script>` content; IP-literal URLs (`http://127.0.0.1/`, `http://[::1]/`, `http://2130706433/`, `http://0x7f.1/`) → `blocked-address` with **no** request received (default lookup); lookup returning `[public, 10.0.0.1]` (all) → blocked; redirect to blocked → blocked; `https→http` → `redirect`; `file:`/`ftp:`/credentials/port 8080 → `bad-url`; 404 → `http-status`; `image/png` → `content-type`; 3 MiB → `too-large`; 100 chars → `too-short`; `HTTP_PROXY` set → still direct.
- [ ] Implement with `node:http`/`node:https` + explicit `new Agent({ lookup })`, guard hostname literal via `net.isIP` after URL parsing; commit `feat(wrapper): SSRF-guarded posting fetcher`.

### Task 5: Claude command and auth check

**Files:** Create `src/evaluation/claude-command.ts`, `src/evaluation/cli-auth.ts`; Tests `test/claude-command.test.ts`, `test/cli-auth.test.ts`; fake CLI `test/support/fake-claude.mjs`.

**Interfaces — Produces:**
- `CLAUDE_EVALUATION_ARGV: readonly string[]` (exact spec list, `--json-schema` + `JSON.stringify(EVALUATION_OUTPUT_JSON_SCHEMA)`, `--system-prompt` + `EVALUATION_SYSTEM_PROMPT`).
- `buildChildEnv(source: NodeJS.ProcessEnv, extra?: Record<string,string>): NodeJS.ProcessEnv`
- `resolveCliPath(config): Promise<string | undefined>` (absolute, executable).
- `createCliAuthChecker(cliPath, { cacheMs = 60_000 }): { check(fresh?: boolean): Promise<"logged-in"|"logged-out"|"check-failed"> }` single-flight.
- Fake CLI: reads behaviour from `FAKE_CLAUDE_SCRIPT` file path **passed via a fixture file next to the binary** (env is allowlisted), records argv/cwd/env keys/stdin to `<binary dir>/last-call.json`.

- [ ] Tests: argv equals constant; contains `--tools` then `""`; never contains `--dangerously-skip-permissions`, `bypassPermissions`, `--mcp-config`; env drops `CAREER_OPS_PAIRING_TOKEN`, `ANTHROPIC_API_KEY`; auth: `loggedIn:true` → logged-in; exit 1 `loggedIn:false` → logged-out; garbage → check-failed; 20 concurrent `check()` → one spawn; second call within 60 s → no spawn; `check(true)` → spawns.
- [ ] Commit `feat(wrapper): fixed claude evaluation command and auth check`.

### Task 6: Prompt, output parsing, diagnostics

**Files:** Create `src/evaluation/evaluation-prompt.ts`, `src/evaluation/evaluation-output.ts`, `src/evaluation/evaluation-diagnostics.ts`; Tests matching names.

**Interfaces — Produces:**
- `readEvaluationInputs(workspace): Promise<EvaluationInputs>` (required `cv.md`, `modes/_shared.md`, `modes/oferta.md`; optional `modes/_profile.md`, `config/profile.yml`, `article-digest.md`; `warnings`).
- `buildEvaluationPrompt(inputs, offer: { company; title; location; url }, posting: string): string` — nonce fence; strips `</job_posting` (case-insensitive) from posting.
- `parseCliOutput(stdout: string): { ok: true; output: EvaluationModelOutput } | { ok: false; kind: "not-json"|"is-error"|"schema" ; resultText?: string }` — accepts `structured_output` object, else JSON parsed from `result` (also inside a ```json fence).
- `describeEvaluationFailure(result: ProcessResult | undefined, parsed, timeoutMs): EvaluationDto["failure"]` — patterns: logged out `/failed to authenticate|not logged in|oauth|\/login|invalid api key/i`; limit = batch-runner patterns.

- [ ] Tests: fence contains nonce on both tags; injected `</job_posting>` removed; output from `structured_output` and from `result` text both parse; `is_error` with "Failed to authenticate: OAuth session expired" → `CLI_NOT_LOGGED_IN`; "usage limit reached" → `CLI_LIMIT_REACHED`; messages never contain stdout text.
- [ ] Commit `feat(wrapper): evaluation prompt, output parsing, diagnostics`.

### Task 7: Writer

**Files:** Create `src/evaluation/evaluation-writer.ts`; modify `src/workspace/safe-file-adapter.ts` (`createOnly?: boolean`); fixture scripts `fixtures/workspaces/career-ops-projection/{reserve-report-num.mjs,merge-tracker.mjs,modes/_shared.md,modes/oferta.md}` (synthetic, same CLI contract as Career Ops); Tests `test/evaluation-writer.test.ts`, `test/safe-file-adapter.test.ts`.

**Interfaces — Produces:**
- `writeEvaluation(input: { workspace; offer: OfferDto; output: EvaluationModelOutput; provider; date: Date; hasTrackerRow: boolean; signal? }): Promise<{ reportFileName: string; scoreText: string; warnings: string[] }>` throws `EvaluationWriteError` on report failure.
- `buildReportMarkdown(...)`, `stripHeaderLines(body)`, `toTrackerTsv(...)`, `cleanCell(s)`, `slugify(company)`.

- [ ] Tests: header URL/score from wrapper even if body has `**URL:**`, `**url:**`, indented `**Score:**`; score 4.25 → `4.3/5` everywhere; create-only refuses existing file; sentinel gone after success, after write failure, after release-script failure, for number `1000`; tracker merged once with `Evaluated`, `X.X/5`, cleaned `|`/newline cells; `hasTrackerRow` → no merge + warning; merge stdout "Skip" → duplicate warning; user's `batch/tracker-additions/x.tsv` untouched.
- [ ] Commit `feat(wrapper): write evaluation report and tracker row`.

### Task 8: Readiness and health

**Files:** Create `src/services/evaluation-readiness.ts`; modify `src/services/health-service.ts`, `src/api/register-routes.ts`; Tests `test/evaluation-readiness.test.ts`, `test/health-service.test.ts`.

**Interfaces — Produces:** `createEvaluationReadiness(config, deps?): { get(fresh?: boolean): Promise<EvaluatorDto> }` with keys from the spec (`evaluation.provider-not-configured`, `evaluation.cli-missing`, `evaluation.cli-logged-out`, `evaluation.cli-check-failed`, `cv.missing`, `cv.too-large`, `modes.shared-missing`, `modes.offer-missing`, `modes.too-large`, `scripts.reserve-report-num-missing`, `scripts.merge-tracker-missing`, `tracker.missing`). One instance shared by health and the service.

- [ ] Tests per key; health `capabilities.aiEvaluation`, `aiCliRequired`; overall `status` unaffected; 20 concurrent health calls → 1 auth spawn.
- [ ] Commit `feat(wrapper): evaluation readiness in health`.

### Task 9: Service, store, routes, OpenAPI

**Files:** Create `src/runs/evaluation-store.ts` (generic over the scan store if trivial, else a copy), `src/services/evaluation-service.ts`, `src/api/evaluation-routes.ts`; modify `src/api/register-routes.ts`, `src/openapi/openapi-document.ts`; Tests `test/evaluation-route.test.ts`, `test/security-boundaries.test.ts`, `test/openapi-*.test.ts`.

**Interfaces — Produces:** `createEvaluationService(config, deps?)` with `start`, `get`, `latest`, `cancel`, `waitForIdle`, `shutdown`; deps injectable: `fetchPosting`, `readiness`, `now`.

- [ ] Route tests covering spec security tests 1–3, 5–10, 12–13, 18–20: token on LAN for all four routes; extra body fields → 400; bad id → 404; busy → 409 `EVALUATION_ALREADY_RUNNING` with `activeEvaluationId`; two simultaneous POSTs → one 202; not ready → 503 `evaluation-not-ready`; no-url → `offer-has-no-url`; evaluated → `offer-already-evaluated`; timeout & cancel write nothing; cancel in `writing` ignored; shutdown kills CLI; leakage test (token, workspace, home printed by fake CLI absent from DTO JSON); success → `GET /offers/{id}` evaluated with same score; recorded cwd ≠ workspace and removed.
- [ ] OpenAPI: four paths, examples, statuses; coverage tests green.
- [ ] Commit `feat(wrapper): evaluation routes`.

### Task 10: Docs

**Files:** `README.md`, `docs/system-architecture.md`, `docs/project-roadmap.md`, `docs/codebase-summary.md`, `docs/deployment-guide.md`, `career-ops-wrapper/.env.example` (if present).

- [ ] Update per spec "Docs to update"; commit `docs: AI offer evaluation`.

### Task 11: Verification

- [ ] `npm test && npm run build` in `career-ops-wrapper/`; Android `./gradlew assembleDevDebug testDevDebugUnitTest lintDevDebug detekt ktlintCheck`.
- [ ] Live check against the real logged-in CLI (spec Step 0) once the owner has logged in; record results in the PR.
