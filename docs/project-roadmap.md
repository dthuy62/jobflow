# Project Roadmap

## Hosted Product

Design: `docs/superpowers/specs/2026-11-02-jobflow-hosted-product-design.md`.

### Phase 1: Foundation

Status: in progress. Plan: `docs/superpowers/plans/2026-11-02-hosted-backend-phase-1.md`. Issues #23 to #29.

- [x] Align repo rules, docs and the review skill.
- [x] npm workspace and `@jobflow/safety`.
- [x] Contract draft and mock server.
- [x] Backend skeleton, database, Compose and CI.
- [x] Authentication, authorization and rate limits.
- [x] Sign-in API: guest, SSO with guest merge, logout.
- [x] Queue and worker.
- [x] Vendor Career Ops.
- [ ] Android: base URL, auth layer, Room.

### Phase 2: Core Loop Without AI

Status: planned. Preferences, CV import and encrypted storage, job index with
scheduled scans, stage-1 matcher, feed, tracker sync, new-job push. Android:
onboarding, feed, job detail, tracker.

### Phase 3: AI Evaluation And Payment

Status: planned. Needs the owner's choice of subscription or credits first.
`LlmProvider`, evaluation set, staged progress over FCM, Play Billing, Play
Integrity, quota, account deletion. Android: evaluate, Live Updates, paywall,
account deletion.

### Before Public Release

Status: planned. The Security baseline items marked "Release", including the
rehearsal on a cloud host.

### Phase 4: Next Features

Status: planned. Share to evaluate, follow-up reminders, compare jobs, CV-vector
ranking.

## Wrapper Roadmap (superseded)

The hosted design supersedes this list, kept as a record. The wrapper is frozen,
and unfinished Android items continue under the hosted phases.

### Current Baseline

- Root documentation initialized.
- Android app rebuilt from android-agentic-starter (Hilt, Navigation 3,
  Konsist, CI).
- Wrapper exposes health, CV, profile, portal, scan-readiness, scan-run,
  evaluation, offer, report, artifact, docs, and OpenAPI route families.
- Android wrapper health integration is done.

### Phase 1: Documentation And Agent Alignment

Status: superseded.

- Establish root `docs/` as product source of truth.
- Keep Android `AGENTS.md` specific to Android implementation rules.
- Add root-level agent instructions only if repo-wide automation needs them.
- Align README, docs, and agent files when commands or structure change.

### Phase 2: Android Health Integration

Status: superseded.

- Finalize Android health DTO and domain mapping.
- Verify Retrofit base URL and pairing token behavior.
- Add UI surface for wrapper/workspace readiness.
- Use wrapper contract examples in Android tests.

### Phase 3: Career Inputs

Status: superseded.

- Add Android screens for CV Markdown, profile config, and portal config.
- Keep Android edits bounded to wrapper DTOs.
- Preserve backend validation and safe file writes.
- Show clear validation and workspace errors.

### Phase 4: Scan Lifecycle

Status: superseded (backend done; Android not started).

- [x] Add typed wrapper scan run start/status endpoints.
- [x] Reject concurrent scans.
- [x] Keep command execution allowlisted.
- [ ] Add Android polling and recoverable UI state.

### Phase 5: Offers, Reports, Artifacts

Status: superseded (backend done; Android not started).

- [x] Parse and project offers from Career Ops workspace outputs.
- [x] Use opaque backend IDs, not file paths.
- [ ] Add Android list/detail surfaces.
- [ ] Add report/artifact open/download flows as local/private features.

### Phase 5b: AI Offer Evaluation

Status: superseded (phase A backend done; Android not started). Issue #3,
`docs/superpowers/specs/2026-10-31-ai-offer-evaluation-design.md`.

- [x] Phase A: `POST /api/v1/evaluations` runs the desktop's logged-in
  `claude` CLI with no tools; the wrapper fetches the posting and writes the
  report and tracker row.
- [ ] Android: start an evaluation from an offer and poll it.
- [ ] Gemini/Codex providers (only if needed).
- [ ] PDF generation from the app (separate issue).
- [ ] Phase B: direct API calls with structured output, prompt caching and an
  eval set (separate issue).

### Phase 6: Release Hardening

Status: superseded.

- [ ] Decide real prod endpoint strategy.
- [ ] Audit cleartext/network security.
- [ ] Harden token storage and setup UX.
- [x] Add wrapper regression tests for critical security boundaries
  (`career-ops-wrapper/test/security-boundaries.test.ts`).
- [ ] Clean generated artifacts and ignored directories from source scope where
  needed.
- [ ] Flip `capabilities.scan/reports/artifacts` in
  `contracts/examples/health.ready.json` together with Android's
  `HealthDtoTest`.
