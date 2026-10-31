# Wrapper Backend Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scan-run, offer, report, and artifact APIs plus security regression tests to `career-ops-wrapper/`.

**Architecture:** Pure parsers turn Career Ops files into records; workspace adapters do bounded, symlink-safe reads; services merge records into DTOs; routes validate IDs and parse responses through Zod. Scan runs are an in-memory store driving `CareerOpsEngineAdapter.runScan()`, which spawns `node scan.mjs` without a shell.

**Tech Stack:** Node 26, TypeScript (NodeNext, strict, `exactOptionalPropertyTypes`), Fastify 5, Zod 4, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-10-30-wrapper-backend-completion-design.md`

## Global Constraints

- All work is inside `career-ops-wrapper/`; never edit `android/` or `dist/`.
- No generic exec endpoint; scan argv is built only from `RunScanArgs` (`dryRun`, `company`).
- IDs: `scan_<yyyymmddHHMMss>_<6hex>`, `offer_<16hex>`, `report_<NNN>`, `artifact_<16hex>`.
- Every DTO leaving a route is parsed by its Zod schema.
- No absolute path, home path, or token in any response body.
- Fixture data is synthetic only.
- Each task ends with `npm test` green and a conventional commit.

## Review Focus

1. Concurrent `POST /scan-runs` (two at once) → exactly one 202 and one 409. Test in Task 6.
2. A scan whose stderr prints the workspace path, home dir, and `CAREER_OPS_PAIRING_TOKEN=x` → none appear in the run DTO. Test in Task 5.
3. `reports/` or `output/` entry symlinked outside the workspace → not listed, not downloadable. Tests in Tasks 3 and 8.
4. Real `scan.mjs` writes `## Pendientes`/`## Procesadas` and pending lines with `| Company | Title` → parsed. Test in Task 2.
5. A tracker row without a resolvable report URL → still listed as its own offer. Test in Task 7.

---

### Task 1: Synthetic fixture workspace

**Files:** Create `fixtures/workspaces/career-ops-projection/**`; modify `fixtures/workspaces/README.md`.

- [ ] Add `cv.md`, `config/profile.yml`, `portals.yml` (same shape as `test/scan-readiness-route.test.ts` YAML), `doctor.mjs`, `scan.mjs` (deterministic; honours `--dry-run`/`--company`; prints the real summary lines `Total jobs found:`, `New offers added:`, an `Errors (1):` block; appends one pending line + history row when not dry-run).
- [ ] Add `data/scan-history.tsv` (4 `added` rows + 1 `skipped_expired`), `data/pipeline.md` (`## Pendientes` with both pending formats, `## Procesadas` with `#001`, `#002`), `data/applications.md` (rows for 001 Evaluated, 002 Applied, 003 with no report link), `reports/001-acme-robotics-2026-06-20.md`, `reports/002-globex-labs-2026-06-21.md`, `reports/003-initech-2026-06-22.md`, `output/cv-jane-doe-acme-robotics-2026-06-20.pdf` (minimal valid PDF).
- [ ] Commit `test(wrapper): add synthetic career-ops projection fixture`.

### Task 2: Parsers

**Files:** Create `src/parsers/{offer-url,score,scan-history-parser,pipeline-parser,applications-parser,report-parser,scan-output-parser}.ts`, re-export from `src/parsers/index.ts`; tests `test/parsers.test.ts`.

**Produces:**
- `normalizeOfferUrl(raw: string): string | undefined`; `offerIdForUrl(url: string): string`; `offerIdForTrackerNumber(n: string): string`
- `parseScoreToPercent(text: string | undefined): number | null` (`"4.2/5"` → 84)
- `parseScanHistory(tsv): ScanHistoryRow[]` `{url, firstSeen, portal, title, company, status, location}`
- `parsePipeline(md): { pending: PipelineEntry[]; processed: PipelineEntry[] }` with `PipelineEntry {url, company?, title?, reportNumber?, scoreText?}`
- `parseApplications(md): TrackerRow[]` `{number, date?, company?, role?, scoreText?, status?, reportNumber?, notes?}`
- `parseReportHeader(md): ReportHeader {title?, kind, date?, url?, scoreText?, pdfPath?}`
- `parseScanOutput(stdout): {offersFound, offersAdded, warnings: string[]}`

- [ ] Tests: score mapping (`4.2/5`→84, `5/5`→100, `N/A`→null, `7/5`→null); URL normalization (host case, fragment, trailing slash); both pipeline section languages and both pending formats; processed `#004 | url | Co | Title | 4.2/5 | PDF ✅`; tracker columns by header name with and without Notes; report header fields; scan output counts and `✗` warnings.
- [ ] Implement; tests pass; commit `feat(wrapper): parse career-ops tracker, pipeline, history and reports`.

### Task 3: Workspace reader

**Files:** Create `src/workspace/workspace-reader.ts`; test `test/workspace-reader.test.ts`.

**Produces:** `readOptionalWorkspaceText(workspace, relativePath, maxBytes): Promise<{content, mtime} | undefined>`; `listWorkspaceFiles(workspace, relativeDir, predicate: (name) => boolean): Promise<WorkspaceFileEntry[]>` with `{name, realPath, sizeBytes, mtime}` — regular non-symlink files whose real path is inside the workspace; missing dir → `[]`.

- [ ] Tests: missing file → undefined; over cap → `PAYLOAD_TOO_LARGE`; symlinked file to outside → excluded/`PATH_OUTSIDE_WORKSPACE`; symlinked directory pointing outside → `[]`.
- [ ] Implement; commit `feat(wrapper): add bounded symlink-safe workspace reader`.

### Task 4: Reports and artifacts catalogs

**Files:** Create `src/workspace/report-file-adapter.ts`, `src/outputs/artifact-catalog.ts`; tests in `test/report-file-adapter.test.ts`, `test/artifact-catalog.test.ts`.

**Produces:** `listReportFiles(workspace): Promise<ReportFile[]>` `{id, number, fileName, markdown, header, mtime}`; `artifactIdForFileName(name)`; `listArtifactFiles(workspace): Promise<ArtifactFile[]>` `{id, fileName, sizeBytes, mtime}`; `openArtifactForDownload(workspace, id): Promise<{fileName, sizeBytes, stream}>` (`O_NOFOLLOW`, fstat regular file, else `NOT_FOUND`).

- [ ] Tests over the fixture: report ids `report_001..003`, duplicate number → first wins; artifact id format; open by id streams bytes; unknown id → `NOT_FOUND`.
- [ ] Implement; commit `feat(wrapper): catalog reports and output PDFs`.

### Task 5: Scan engine adapter and output sanitizer

**Files:** Modify `src/career-ops-engine/career-ops-engine-adapter.ts`; create `src/career-ops-engine/scan-output.ts`; modify `src/config/runtime-config.ts`, `src/config/env.ts` (`scanTimeoutMs`); tests `test/career-ops-engine-adapter.test.ts`, `test/scan-output.test.ts`.

**Produces:** `RunScanArgs {dryRun: boolean; company?: string}`; `buildScanArgv(args): string[]`; `createCareerOpsEngineAdapter(workspace): CareerOpsEngineAdapter` with `runScan({args, timeoutMs}): Promise<ScanProcessResult>` `{exitCode: number|null, signal: string|null, timedOut, spawnError: boolean, stdout, stderr}`; `sanitizeScanOutputLine(line, {workspacePath, workspaceRealPath}): string`.

- [ ] Tests: argv for `{dryRun:true, company:"Acme"}` is `["scan.mjs","--dry-run","--company","Acme"]`; child receives no `CAREER_OPS_*` env (fixture script prints env); timeout kills a sleeping script with `timedOut: true`; output capped at 256 KiB tail; sanitizer removes workspace path, home dir, token, absolute paths, `..`.
- [ ] Implement; commit `feat(wrapper): run scan.mjs through an allowlisted engine adapter`.

### Task 6: Scan run store, service, routes

**Files:** Create `src/runs/scan-run-store.ts` (replace stub index export), `src/services/scan-run-service.ts`, `src/api/scan-run-routes.ts`; modify `src/api/register-routes.ts`; contract `StartScanRunRequestDtoSchema` in `src/contracts/scan-run-contract.ts`; tests `test/scan-run-route.test.ts`.

**Produces:** `ScanRunService {startScan(req): Promise<ScanRunDto>; getScanRun(id): ScanRunDto; getLatestScanRun(): ScanRunDto; waitForIdle(): Promise<void>}` (`waitForIdle` for tests and shutdown).

- [ ] Tests: 202 running then poll to `succeeded` with summary counts from fixture output; failing script → `failed` + `COMMAND_FAILED`; not-ready workspace → 503 `scan-not-ready`; two parallel POSTs → one 202 + one 409 `activeScanRunId`; invalid body (`company: "--verify"`, unknown key) → 400; unknown id → 404; `/latest` before any run → 404.
- [ ] Implement; commit `feat(wrapper): add scan run start and status endpoints`.

### Task 7: Offer service and routes

**Files:** Create `src/workspace/career-ops-data-adapter.ts`, `src/services/offer-service.ts`, `src/api/offer-routes.ts`; modify `src/contracts/offer-contract.ts` (`evaluationStatus`, `OfferCollectionDtoSchema`); tests `test/offer-service.test.ts`, `test/offer-route.test.ts`.

- [ ] Tests over the fixture: history-only URL → `new`/`notEvaluated`/score null; tracker Evaluated row with report → `tracked`, score 84, `reportId: "report_001"`, artifactIds = the PDF id; Applied → `applied`; tracker row 003 without URL → own offer; `skipped_expired` row excluded; detail by id; unknown id → 404; empty workspace data → `items: []`.
- [ ] Implement; commit `feat(wrapper): project offers from scan history, pipeline and tracker`.

### Task 8: Report and artifact services and routes

**Files:** Create `src/services/report-service.ts`, `src/services/artifact-service.ts`, `src/api/report-routes.ts`, `src/api/artifact-routes.ts`; modify `src/contracts/report-contract.ts` (bounded markdown, collection schema), `src/contracts/artifact-contract.ts` (collection schema); tests `test/report-route.test.ts`, `test/artifact-route.test.ts`.

- [ ] Tests: report list newest first with `offerId` linked; detail markdown includes `../output` link and redacts an absolute workspace path planted in it; artifact list links `reportId`; download returns `application/pdf`, `content-disposition` attachment, exact bytes; symlinked PDF to outside not listed.
- [ ] Implement; commit `feat(wrapper): serve reports and artifact downloads`.

### Task 9: Health, OpenAPI, contract examples, security suite

**Files:** Modify `src/services/health-service.ts`, `src/openapi/openapi-document.ts`, `contracts/examples/*`, `test/openapi-document.test.ts`, `test/contract-examples.test.ts`, `test/health-service.test.ts`; create `test/security-boundaries.test.ts`.

- [ ] Health capabilities per spec; OpenAPI paths for all nine routes with examples from `contracts/examples`.
- [ ] Security suite: token required on every OpenAPI path except health (LAN mode); traversal IDs on each `{id}` route → 404; no workspace path/home/token in any response.
- [ ] Commit `feat(wrapper): document new routes and harden security boundaries`.

### Task 10: Docs

- [ ] Update `career-ops-wrapper/README.md`, `docs/system-architecture.md`, `docs/project-roadmap.md`, `docs/codebase-summary.md`. Commit `docs: describe scan, offer, report and artifact APIs`.
