# Wrapper Backend Completion Design (Roadmap Phases 4–6, backend)

Date: 2026-10-30
Scope: `career-ops-wrapper/` only. Android is out of scope.

Decisions marked **(agreed)** came from the user. Decisions marked
**(builder's call)** were made while writing this spec and should be reviewed.

## Goal

Give the Android app every wrapper API it needs after Phase 3:

| Route | Purpose |
| --- | --- |
| `POST /api/v1/scan-runs` | Start a local `scan.mjs` run |
| `GET /api/v1/scan-runs/latest` | Most recent run (app restart recovery) |
| `GET /api/v1/scan-runs/{id}` | Poll run status |
| `GET /api/v1/offers` | Offer projection list |
| `GET /api/v1/offers/{id}` | Offer detail |
| `GET /api/v1/reports` | Evaluation report list |
| `GET /api/v1/reports/{id}` | Report detail with Markdown |
| `GET /api/v1/artifacts` | Generated PDF list |
| `GET /api/v1/artifacts/{id}/download` | Stream one PDF |

All of them are protected by the Local Pairing Token in LAN mode, because the
existing guard protects every `/api/v1` route except `GET /health` **(agreed)**.

## Non-goals

- No AI evaluation. The wrapper never runs AI CLIs or provider scripts. Scores
  and reports come from desktop evaluation **(agreed)**.
- No writes to the tracker, reports, or PDFs. Offers, reports, and artifacts are
  read-only projections **(agreed)**.
- No generic exec endpoint, no cancel endpoint, no persistent run history
  **(builder's call: runs live in memory; a restart forgets them)**.
- No pagination. A personal workspace has hundreds of rows, not millions
  **(builder's call)**.

## Layering

The code follows the existing route → service → workspace adapter → contract
order.

| Layer | New modules |
| --- | --- |
| Routes (`src/api/`) | `scan-run-routes.ts`, `offer-routes.ts`, `report-routes.ts`, `artifact-routes.ts` |
| Services (`src/services/`) | `scan-run-service.ts`, `offer-service.ts`, `report-service.ts`, `artifact-service.ts` |
| Engine (`src/career-ops-engine/`) | `career-ops-engine-adapter.ts` (implemented), `scan-diagnostics.ts` |
| Runs (`src/runs/`) | `scan-run-store.ts` (in-memory run registry) |
| Parsers (`src/parsers/`) | `scan-history-parser.ts`, `pipeline-parser.ts`, `applications-parser.ts`, `report-parser.ts`, `score.ts`, `offer-url.ts` |
| Workspace IO (`src/workspace/`) | `workspace-reader.ts` (bounded, symlink-safe reads and listings), `career-ops-data-adapter.ts`, `report-file-adapter.ts` |
| Outputs (`src/outputs/`) | `artifact-catalog.ts` (lists `output/*.pdf`, opens one for streaming) |
| Contracts | `scan-run-contract.ts`, `offer-contract.ts`, `report-contract.ts`, `artifact-contract.ts` updated additively |

`src/storage/` stays an empty stub **(builder's call: nothing needs
persistence)**.

## Scan runs

### Start

`POST /api/v1/scan-runs` with an optional JSON body:

```json
{ "dryRun": false, "company": "Acme Robotics" }
```

- Argument allowlist **(agreed: dry-run and company)**: `dryRun: true` maps to
  `--dry-run`; `company` maps to the two argv elements `--company`, `<name>`.
- `--verify`, `--headed-fallback`, `--throttle`, and `--rediscover-404` are not
  exposed **(builder's call: `--verify` needs Playwright/Chromium, can run for a
  long time, and its headed fallback needs a display; the desktop can still run
  it)**.
- `company` must be 1–100 characters, must not start with `-`, and may only
  contain letters, digits, spaces, and `. & ' ( ) + , -` **(builder's call)**.
  Unknown body keys are rejected with `VALIDATION_ERROR`.
- Order of checks:
  1. Body validation → `VALIDATION_ERROR` (400).
  2. An active run exists → `SCAN_ALREADY_RUNNING` (409) with
     `details.activeScanRunId` **(agreed)**. The slot is reserved synchronously
     before any `await`, so two concurrent POSTs can never both start.
  3. Scan readiness (`ScanReadinessService`) is not ready → release the slot,
     `WORKSPACE_UNHEALTHY` (503) with
     `details: { reason: "scan-not-ready", missingRequirements }`
     **(builder's call: reuse an existing code instead of adding one, because
     Android mirrors `contracts/error-codes.json`)**.
  4. Spawn, return **202** with the `ScanRunDto` (`status: "running"`,
     `stage: "executing"`).

### Execution (`CareerOpsEngineAdapter.runScan`)

- `spawn(process.execPath, ["scan.mjs", ...allowlistedArgs], { cwd, shell: false })`.
  Using `process.execPath` avoids a `PATH` lookup for `node`.
- `cwd` is the workspace real path. `scan.mjs` is resolved through the path
  guard and must be a regular file inside the workspace.
- The child environment is `process.env` minus every `CAREER_OPS_*` variable,
  so the pairing token never reaches the child **(builder's call)**.
- Timeout: default 10 minutes, configurable through `RuntimeConfig.scanTimeoutMs`
  (env `CAREER_OPS_SCAN_TIMEOUT_MS`) **(builder's call)**. On timeout the child
  gets `SIGTERM`, then `SIGKILL` after 5 seconds.
- The child is spawned `detached` so it leads its own process group. Timeout,
  wrapper shutdown (`server.close()`, SIGINT/SIGTERM), and wrapper exit signal
  the whole group, and any process left in the group after `scan.mjs` exits is
  killed. A run settles on `exit` (pipes get 250 ms to drain), so a grandchild
  holding the pipes cannot keep the run active **(builder's call, from review)**.
- stdout and stderr are each capped at 256 KiB; only the tail is kept. They stay
  inside the wrapper and are never returned raw **(builder's call)**.
- The existing placeholder interface (`RunScanInput`/`RunScanResult`, unused)
  is replaced by `runScan({ args, timeoutMs }) → { exitCode, signal, timedOut,
  stdout, stderr }` and a `RunScanArgs` type that holds only allowlisted values.

### Status

`ScanRunDto` (unchanged contract):

| Situation | `status` | `stage` | `active` |
| --- | --- | --- | --- |
| Slot reserved, readiness pending | `pending` | `queued` | `true` |
| Child running | `running` | `executing` | `true` |
| Exit 0 | `succeeded` | `completed` | `false` |
| Non-zero exit, timeout, spawn error | `failed` | `failed` | `false` |

- `id`: `scan_<UTC yyyymmddHHMMss>_<6 hex>`; never a path.
- `summary.offersFound` comes from the `Total jobs found:` line;
  `summary.offersProjected` from `New offers added:` (0 for dry runs, because
  nothing is written) **(builder's call)**. Missing lines → 0.
- `summary.warnings` and `failure.message` are built from structured data
  only; see [Scan diagnostics](#scan-diagnostics) **(agreed, issue #9)**.
- `failure.code` is one of `COMMAND_FAILED`, `COMMAND_TIMEOUT`, `SPAWN_FAILED`.
- `GET /scan-runs/{id}` for an unknown ID → `NOT_FOUND`. The store keeps the 20
  most recent runs.
- `GET /scan-runs/latest` → the most recent run, or `NOT_FOUND` when none ran
  since startup.

### Scan diagnostics

Updated 2026-10-31 for issue #9. This replaces the regex redaction of scan
output (`sanitizeScanOutputLine`), which kept leaking through new edge cases.

**Rule (agreed):** raw `scan.mjs` stdout and stderr never leave the wrapper:
not in `ScanRunDto`, not in errors, not in logs. Every warning and failure
message is assembled from four kinds of value only:

1. a company name taken from `portals.yml`, never from the output,
2. an error category from the fixed enum below,
3. a count (an integer the wrapper parsed),
4. a fixed wrapper sentence.

The output is still read inside the wrapper to pick categories and counts.
`src/career-ops-engine/scan-diagnostics.ts` holds the mapping;
`src/parsers/scan-output-parser.ts` only splits the output into counts and raw
error lines.

#### Known companies

The wrapper reads `portals.yml` (or `portals.yaml`) after the scan finishes and
collects the `name` of every entry in `tracked_companies` and `job_boards`, the
two lists `scan.mjs` scans. A name is kept only if it passes
`ScanCompanySchema` (letters, digits, space and `.&'()+,-`, at most 100
characters), so a name can never carry `/`, `:`, `@`, `%`, `?` or `#`
**(builder's call)**. An unreadable or invalid `portals.yml` gives an empty
list: every error line then counts as unmatched, and the run still completes
**(builder's call)**.

#### Error lines → categories

`scan.mjs` prints each company error as `  ✗ <entry.name>: <error>`. For each
such stdout line the wrapper finds the longest known name `N` for which the
text after `✗ ` starts with `N: ` (exact, case-sensitive, because `scan.mjs`
prints the name verbatim). The `<error>` text is then matched, case-insensitive,
against these rules in order; the first match wins **(builder's call)**:

| Category | Matches (summary) | Warning sentence |
| --- | --- | --- |
| `timeout` | `timeout`, `timed out`, `ETIMEDOUT`, `abort` | `<Company>: the careers page timed out.` |
| `blocked` | status `401`, `403`, `429`, `forbidden`, `unauthorized`, `rate limit`, `too many requests`, `captcha`, `blocked` | `<Company>: the careers page blocked the request.` |
| `not-found` | status `404`, `410`, `not found` | `<Company>: the careers page was not found.` |
| `fetch-failed` | `HTTP <3 digits>`, `status <3 digits>`, `fetch failed`, `ENOTFOUND`, `ECONNREFUSED`, `ECONNRESET`, `EAI_AGAIN`, `socket`, `network`, `certificate`, `TLS` | `<Company>: the careers page could not be fetched.` |
| `parse-error` | `JSON`, `parse`, `Unexpected token`, `did not return an array` | `<Company>: the careers page response could not be read.` |
| `config-error` | `invalid URL`, `must use HTTPS`, `must be http`, `untrusted hostname`, `cannot derive`, `careers_url`, `is required`, `requires`, `escapes the project root` | `<Company>: the portal entry is not set up correctly.` |
| `other` | anything else | `<Company>: the scan failed for this company.` |

- One warning per company and category; repeats are dropped
  **(builder's call)**.
- **Unmatched lines** (no known name, or an empty name) are dropped and
  counted. When the count is above 0 the wrapper adds
  `<n> scan error(s) could not be matched to a company in portals.yml.`
  **(builder's call)**.
- `Agent/WebSearch handoff: <n> …` becomes
  `<n> compan(y|ies) need(s) an Agent/WebSearch scan.` The bullet lines below
  it (names, queries, URLs) are ignored, as before.
- Every other line is ignored: offer lines, `⚠️` notices on stderr, the
  `Results saved to <path>` line.
- Order: handoff, then company warnings in output order, then the unmatched
  count. At most 20 entries: when there are more, the first 19 are kept and the
  last becomes `<n> more scan warnings were omitted.` **(builder's call)**.

#### Failure message

`failure.code` is unchanged. `failure.message` is one fixed sentence, plus at
most one fixed reason picked from stderr **(builder's call)**:

| Case | Message |
| --- | --- |
| Spawn failed | `Career Ops scan could not be started.` |
| Timeout | `Career Ops scan exceeded the <n>-second timeout.` |
| Non-zero exit | `Career Ops scan exited with code <n>.` |
| Killed by a signal | `Career Ops scan was stopped by <SIGNAME>.` (`a signal` unless the name matches `^SIG[A-Z0-9]+$`) |

Stderr reasons, appended after a space:

| stderr contains | Reason |
| --- | --- |
| `portals.yml not found` | `portals.yml was not found.` |
| `failed to parse` | `portals.yml could not be parsed.` |
| `no providers loaded` | `No scan providers could be loaded.` |

Anything else in stderr adds no reason.

#### What the app sees

`summary.warnings` stays `string[]` and `failure` keeps `{code, message}`, so
Android DTOs parse unchanged. Only the wording changes, from redacted raw text
to the fixed sentences above. The categories are not exposed as a separate
field **(builder's call: the issue keeps the contract shape)**.

`redactLocalValues` stays for report Markdown; it is no longer used for scan
output.

## Offers

### Sources and merge

The service reads three files and merges by normalized URL **(agreed)**.
Missing files are treated as empty.

| Source | Format | Contributes |
| --- | --- | --- |
| `data/scan-history.tsv` | `url first_seen portal title company status location` | company, title, location, source (portal), firstSeenAt |
| `data/pipeline.md` | Pending: `- [ ] <url>` or `- [ ] <url> \| Company \| Title`. Processed: `- [x] #NNN \| <url> \| Company \| Title \| 4.2/5 \| PDF ✅` | presence, report number, score |
| `data/applications.md` | table `# \| Date \| Company \| Role \| Score \| Status \| PDF \| Report \| Notes` | tracker status, score, report number, notes, date |
| `reports/NNN-*.md` | `**URL:**`, `**Score:**`, `**PDF:**` headers | URL for tracker rows, PDF link |

- Section headers `## Pending`/`## Pendientes` and `## Processed`/`## Procesadas`
  are all accepted, because `scan.mjs` writes the Spanish names.
- Tracker rows have no URL. Their URL comes from the linked report's
  `**URL:**` line. A tracker row with no resolvable URL becomes its own offer
  keyed by tracker number **(builder's call)**.
- Columns are located by header name, not position, so a missing `Notes`
  column is fine.
- Scan-history rows with a status other than `added` (for example
  `skipped_expired`) are excluded: they never reached the pipeline
  **(builder's call)**.
- URL normalization: trim, lowercase scheme and host, drop the fragment, drop a
  trailing `/` from the path. The query string is kept.

### Fields

- `id`: `offer_` + first 16 hex of `sha256(normalizedUrl)`, or of
  `tracker:<number>` for URL-less rows **(agreed: stable, opaque)**.
- `status`: tracker status wins, using the canonical Career Ops states
  (`templates/states.yml`, aliases included):

  | Career Ops state | `OfferDto.status` |
  | --- | --- |
  | Evaluated | `tracked` |
  | Applied, Responded, Interview, Offer | `applied` |
  | Rejected | `rejected` |
  | Discarded, SKIP | `archived` |
  | anything else | `unknown` |

  Without a tracker row: processed pipeline line → `tracked`; pending line or
  scan history only → `new` **(builder's call)**.
- `score`: `x/5` → `round(x × 20, 1)`, so `4.2/5` → `84`. Values outside 0–5 or
  unparsable → `null`. The contract keeps its 0–100 range **(builder's call:
  the agreed mapping; no contract change)**.
- New additive field `evaluationStatus: "evaluated" | "notEvaluated"`:
  `evaluated` when a score or report exists **(builder's call: makes the agreed
  "not evaluated yet" state explicit; Android ignores unknown keys)**.
- `reportId`: `report_NNN` from the tracker link or the processed `#NNN`, only
  when that report file exists.
- `artifactIds`: the artifact named by the report's `**PDF:** output/<file>.pdf`
  line, only when that file exists.
- `source`: scan-history portal, else `career-ops`. `rawSource`: names of the
  files that contributed, such as `scan-history, pipeline, tracker`.
- `firstSeenAt`: scan-history date, else tracker date, as `YYYY-MM-DDT00:00:00.000Z`.
  `lastSeenAt`: `null`. `scanRunId`: `null` (history rows cannot be tied to a
  wrapper run) **(builder's call)**.
- `workMode`: inferred from location text (`remote`, `hybrid`,
  `on-site`/`onsite`), else `unknown`.
- `company`/`title` fall back to `Unknown company`/`Untitled role`.
- Text that fails `SanitizedTextSchema` (path-like) is dropped and a warning is
  added, rather than failing the whole list **(builder's call)**.

### Responses

- `GET /offers` → `{ items: OfferDto[], syncedAt, sourceRevision }`, sorted by
  `firstSeenAt` descending then `id`. `sourceRevision` is
  `offers_sha256_<8 hex>` over the source files.
- `GET /offers/{id}` → one `OfferDto` or `NOT_FOUND`.
- File size caps: 10 MiB for `scan-history.tsv`, 2 MiB for each Markdown file;
  over the cap → `PAYLOAD_TOO_LARGE` on the offer routes. Report and artifact
  routes treat a data file that is oversized, unreadable, or resolves outside
  the workspace as empty and only lose offer links **(builder's call)**.

## Reports

- Source: regular files in `reports/` named `NNN-<slug>-YYYY-MM-DD.md` (or
  `NNN-<slug>.md`). Other files are ignored. Symlinks are skipped.
- `id`: `report_NNN` **(agreed: from the report number)**. If two files share a
  number, the first by file name wins **(builder's call)**.
- `title`: the `# Evaluation: …` (or `# Evaluación: …`) heading text, else
  `Report NNN`. `kind`: `evaluation` for those headings, else `unknown`.
- `createdAt`: `**Date:**`, else the file-name date. `updatedAt`: file mtime.
- `offerId`: from `**URL:**` (same hash as offers), else from a tracker row
  that links the report **(agreed)**.
- `sourceRevision`: `report_sha256_<8 hex>` of the file.
- `markdown`: the raw file, capped at 1 MiB (`PAYLOAD_TOO_LARGE` over it), with
  the workspace path and home directory redacted. The contract's `markdown`
  field changes from `SanitizedTextSchema` to a bounded string, because real
  reports contain relative links such as `../output/x.pdf` that the path
  pattern rejects **(builder's call)**.
- `GET /reports` → `{ items: ReportListItemDto[], syncedAt, sourceRevision }`,
  newest number first.
- `GET /reports/{id}`: the ID must match `^report_\d{1,6}$`. Anything else →
  `NOT_FOUND`, without echoing the ID. The ID is looked up in the directory
  listing; it is never joined into a path **(builder's call)**.

## Artifacts

- Source: regular, non-symlink `*.pdf` files directly inside `output/`
  **(agreed)**. Subdirectories are ignored, and so is a file whose name fails
  `SanitizedTextSchema` (for example `cv..\old.pdf`) **(builder's call)**.
- `id`: `artifact_` + first 16 hex of `sha256(filename)`.
- `contentType`: `application/pdf`. `downloadUrl`:
  `/api/v1/artifacts/<id>/download`. `createdAt`: mtime.
- `offerId`/`reportId`: from the report whose `**PDF:**` line names the file.
- `GET /artifacts` → `{ items: ArtifactDto[], syncedAt, sourceRevision }`.
- `GET /artifacts/{id}/download`:
  - ID must match `^artifact_[a-f0-9]{16}$`, else `NOT_FOUND`.
  - Looked up in the listing; the file is opened with `O_NOFOLLOW`, then
    `fstat` must show a regular file whose real path is still inside
    `output/`.
  - Headers: `Content-Type: application/pdf`, `Content-Length`,
    `Content-Disposition: attachment; filename="<ascii-safe name>"`,
    `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`.

## Health

`capabilities.reports` and `capabilities.artifacts` become `workspace ready`;
`capabilities.scan` becomes `workspace ready && careerOps ready`.

`contracts/examples/health.ready.json` keeps `scan/reports/artifacts: false`
for now **(builder's call: Android's `HealthDtoTest` asserts
`capabilities.scan == false` on that file, and this task must not touch
Android; flip the example together with that one-line Android test)**.

## Security hardening (Phase 6, backend)

Regression tests:

1. Token enforcement on every protected route. The test walks the OpenAPI
   document's paths so a future route cannot skip it.
2. ID and path traversal: `..%2F..%2Fetc%2Fpasswd`, `%2e%2e`, absolute paths,
   `report_001/../../x`, backslashes, NUL bytes, and over-long IDs on every
   `{id}` route → 404 with no file content.
3. Symlinks: a `reports/` file or `output/` PDF symlinked outside the workspace
   is never listed or served.
4. No workspace path, home path, or token in any response body, error, scan
   warning, or failure message, including a scan whose stdout and stderr print
   them. The suite also covers the six round-3 leaks from PR #8: URL userinfo
   after `-`/`+`/`.`/a digit, `?`/`#` in a password, a sibling folder such as
   `<workspace>-old`, a `...` run, a `..` climb-out after a space or comma, and
   `%2e%2e` (`test/scan-diagnostics.test.ts`, `test/scan-run-route.test.ts`).
5. Scan concurrency: two simultaneous POSTs → one 202, one 409.
6. Contract examples for every new DTO are validated by tests and used as
   OpenAPI examples.

## Contract examples

New or updated in `contracts/examples/`:

- `scan-run.running.json` (kept), `scan-run.succeeded.json`, `scan-run.failed.json`
- `offer.valid.json` (adds `evaluationStatus`), `offer.not-evaluated.json`
- `offers.collection.json`, `reports.collection.json`, `artifacts.collection.json`
- `report.detail.valid.json` and `artifact.valid.json` updated to the real ID
  formats
- `errors/scan-not-ready.json`, `errors/not-found.json`

## Fixture workspace

`fixtures/workspaces/career-ops-projection/` holds synthetic data only (fake
companies and people): CV, profile, portals, `doctor.mjs`, a deterministic
`scan.mjs` that prints the real summary format, tracker files, three reports,
and one tiny PDF. Tests that run a scan copy it to a temp directory first.

## Testing

Test-first per module: parser unit tests, adapter tests on temp workspaces,
service tests, route tests through `server.inject`, and the security suite
above. Checks: `npm test`, `npm run build`, and a manual `npm run dev` smoke
run against a copy of the fixture.
