# Project Roadmap

## Current Baseline

- Root documentation initialized.
- Android task arena exists with Room persistence and Compose UI.
- Wrapper exposes health, CV, profile, portal, scan-readiness, docs, and
  OpenAPI route families.
- Android wrapper health integration is in progress.

## Phase 1: Documentation And Agent Alignment

Status: in progress.

- Establish root `docs/` as product source of truth.
- Keep Android `AGENTS.md` specific to Android implementation rules.
- Add root-level agent instructions only if repo-wide automation needs them.
- Align README, docs, and agent files when commands or structure change.

## Phase 2: Android Health Integration

Status: in progress.

- Finalize Android health DTO and domain mapping.
- Verify Retrofit base URL and pairing token behavior.
- Add UI surface for wrapper/workspace readiness.
- Use wrapper contract examples in Android tests.

## Phase 3: Career Inputs

Status: planned.

- Add Android screens for CV Markdown, profile config, and portal config.
- Keep Android edits bounded to wrapper DTOs.
- Preserve backend validation and safe file writes.
- Show clear validation and workspace errors.

## Phase 4: Scan Lifecycle

Status: planned.

- Add typed wrapper scan run start/status endpoints.
- Reject concurrent scans.
- Keep command execution allowlisted.
- Add Android polling and recoverable UI state.

## Phase 5: Offers, Reports, Artifacts

Status: planned.

- Parse and project offers from Career Ops workspace outputs.
- Use opaque backend IDs, not file paths.
- Add Android list/detail surfaces.
- Add report/artifact open/download flows as local/private features.

## Phase 6: Release Hardening

Status: planned.

- Decide real prod endpoint strategy.
- Audit cleartext/network security.
- Harden token storage and setup UX.
- Add regression tests for critical security boundaries.
- Clean generated artifacts and ignored directories from source scope where
  needed.
