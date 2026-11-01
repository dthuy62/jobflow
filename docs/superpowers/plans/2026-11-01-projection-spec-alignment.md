# Projection and Spec Alignment Plan

**Goal:** Land the five owner rulings of 2026-11-01 on the wrapper backend spec,
the report sanitizer improvements of issue #17, and the contract example check
of issue #19, in one PR.

**Specs:** `docs/superpowers/specs/2026-10-30-wrapper-backend-completion-design.md`,
`docs/superpowers/specs/2026-10-31-report-markdown-links-design.md`.

**Constraints:** no Android DTO change, no new error code, contract examples and
OpenAPI stay in sync. Test first for every code change.

## Part A: owner rulings (2026-11-01)

1. **Report-only offers** (`career-ops-projection.ts`). Keep the offer. Without a
   tracker status, an offer with a report (`**URL:**`) is `tracked`, because it
   was evaluated. Test: report-only offer → `tracked`. Spec status table.
2. **Report titles.** Code unchanged. Spec: first `# ` heading, Evaluation
   prefix stripped, else `Report NNN`.
3. **Scan company names** (`scan-run-contract.ts`, `scan-diagnostics.ts`).
   `ScanCompanySchema` = trim, 1–100 chars, not starting with `-`, no control
   characters or line/paragraph separators. Still one argv element.
   `portals.yml` names use the same schema, plus an echo check: a name is only
   echoed in a warning when the report sanitizer leaves it unchanged (home,
   workspace, path shapes, token patterns, pairing token) and it passes
   `SanitizedTextSchema`. Others count as unmatched. Tests: `/`, `—`, leading
   `(`/`.` accepted; `-x`, newline, control char rejected; route 400s;
   path-like names never echoed. OpenAPI, spec.
4. **`offersProjected` on failure** (`scan-run-service.ts`). Parsed
   `New offers added:` count even when the run failed; dry run → 0; missing →
   0. Test via route with a failing fake scan. Spec.
5. **Report `offerId`** (`career-ops-projection.ts`). Offer of the report's own
   normalized `**URL:**`, else the offer of the first tracker row linking the
   report, else `null`. `OfferDto.reportId` unchanged. Tests: same URL in 004
   and 009 with the tracker on 009 → both reports keep the offer; pipeline
   `#007` on another URL does not take report 007.

## Part B: issue #17 (`src/security/report-markdown.ts`)

- Closing HTML tags (`</b>`, `text</em>`) are kept, not turned into
  `[local path]`. Only `</name>` with a one-segment tag name qualifies.
- Relative links to a listed report file (`004-acme.md`, `./004-acme.md`,
  `../reports/004-acme.md`, fragment dropped) are rewritten to
  `/api/v1/reports/report_004`; the context gets `reportIdByFileName`. Pass 3
  allows that exact route path like the artifact download path.
- `**PDF:** output/x.pdf` header lines naming a listed artifact become a link
  to its download.
- Residual risks: stay documented unless a fix is cheap and clean. No arms race.

## Part C: issue #19

A strict shared test schema for the `evaluation-not-ready` details
(`reason` literal, `missingRequirements` from the known requirement codes) is
used by both the route test (real response) and the contract example test.

## Verification

`npm test`, `npm run build`, then `.claude/skills/review-change/` at the printed
tier (L expected), up to 3 rounds.
