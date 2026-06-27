---
created: 2026-06-27
project: task-arena
change_trigger: production-security-boundary-for-story-1-5
status: approved
scope: moderate
---

# Sprint Change Proposal: Production Security Boundary

## 1. Issue Summary

During review of Android Story 1.5, the setup-health UI scope was found to mix local MVP connection behavior with production security assumptions.

The specific problem: Story 1.5 previously implied user-entered Wrapper Backend base URL and Local Pairing Token fields. That is not the desired MVP implementation. Android already has product flavors and BuildConfig-backed wrapper configuration. The setup screen should check health and readiness from configured values, not expose URL/token editing.

The production security discussion also identified a separate future need: when the app/backend move toward public or hosted access, Local Pairing Token and BuildConfig values are not production authentication. Production hardening needs Firebase App Check, backend verification middleware, HTTPS assumptions, server-held secrets/private keys, and optional user auth or certificate/public-key pinning.

## 2. Impact Analysis

Epic 1 remains valid. Story 1.5 is narrowed to local/MVP setup-health:

- No URL input.
- No token input.
- Use `BuildConfig.CAREER_OPS_DEFAULT_BASE_URL` or equivalent local build/session configuration.
- Show connection status, workspace readiness, retry/check action, and guidance.

Architecture needed light correction because it still referenced prod setup-screen URL entry. That wording was updated to match the configured BuildConfig/local build approach.

PRD FR-1 needed light correction because it still described user-entered endpoint configuration. It now says the app uses a configured wrapper endpoint for MVP.

Sprint backlog needed a future production hardening epic so this concern is not lost.

## 3. Recommended Approach

Use Direct Adjustment:

- Patch Story 1.5 and related Epic 1 wording now.
- Add Epic 7 for production access hardening.
- Do not implement Firebase App Check or production security inside Story 1.5.
- Do not roll back completed Story 1.4; it already created the correct flavor/BuildConfig foundation.

Rationale: this keeps the MVP moving while preserving the real security work for a properly scoped cross-platform/backend slice.

## 4. Detailed Change Proposals

### PRD

Old intent:

- User enters, saves, and updates the Wrapper Backend endpoint.

New intent:

- Android uses the wrapper endpoint supplied by flavor BuildConfig or local build/session configuration.
- Setup UI does not require user-entered URL/token fields for local MVP.
- Production/public backend security hardening is explicitly out of MVP.

### Architecture

Old intent:

- Prod flavor requires setup-screen URL entry for LAN/private wrapper access.

New intent:

- Prod/local MVP uses configured BuildConfig or local build values.
- Local Pairing Token is only trusted local/LAN protection, not production authentication.
- Production/public access is deferred to a separate hardening epic.

### Epics and Stories

Story 1.5 now owns only setup-health UI:

- Check `/api/v1/health`.
- Render loading, ready, not-ready, unreachable, malformed-response, and workspace guidance states.
- Preserve health UI state across ViewModel recreation.
- No URL/token input fields.
- No production App Check/Auth/pinning.

New Epic 7: Harden Production Access:

- Story 7.1: Define Production Security Mode and Trust Boundaries.
- Story 7.2: Verify Firebase App Check on Backend Requests.
- Story 7.3: Attach App Check Tokens from Android.
- Story 7.4: Enforce Production HTTPS and Optional Pinning.

## 5. Implementation Handoff

Scope classification: Moderate.

Developer handoff:

- Continue current MVP with Story 1.5 as local setup-health only.
- Use BuildConfig/local build configuration for wrapper connection values.
- Do not add runtime endpoint editor, token field, endpoint registry, or production security dependencies in Story 1.5.

Product/backlog handoff:

- Keep Epic 7 in backlog until publish/public backend work begins.
- Revisit Firebase App Check, Auth, HTTPS, and pinning only when production access is actually in scope.

## Checklist Result

- [x] Trigger identified: Story 1.5 setup-health scope.
- [x] Core problem defined: local MVP setup UI was conflated with production security.
- [x] Evidence collected: PRD, architecture, and epics had old user-entered URL/setup wording; Story 1.4 implementation already uses BuildConfig.
- [x] Epic impact assessed: Epic 1 narrowed; Epic 7 added.
- [x] PRD impact assessed and patched.
- [x] Architecture impact assessed and patched.
- [x] Path selected: direct adjustment, no rollback, no MVP reduction.
- [x] Sprint status updated with Epic 7 backlog entries.

