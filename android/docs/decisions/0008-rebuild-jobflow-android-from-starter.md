# 8. Rebuild JobFlow Android from the starter

Status: Accepted (2026-10-30)

## Context

The first JobFlow Android app grew from an unrelated "task arena" app: about a third of its code was a dead feature, DI
was a hand-written `AppContainer` with `ViewModelProvider.Factory` classes, the error type in `core/` imported Retrofit,
nothing enforced the layer rules, and there was no CI. The only parts worth keeping were the health feature, the wrapper
contract DTOs and their tests, the network client and the visual design. Meanwhile android-agentic-starter already had
Hilt, Navigation 3, Konsist, detekt, ktlint, docs checks, ADRs and an agent layer.

## Decision

Replace `android/` with a copy of the starter taken from its git `HEAD`, keep the JobFlow identity (`me.dthuy.jobflow`,
`dev`/`prod` flavors, shared debug key, launcher and splash resources) through `mobile-app-config`, and port only:

- the health feature, contract DTOs and contract tests;
- the Retrofit client ([ADR 9](0009-retrofit-kotlinx-serialization-network-layer.md));
- the soft palette, typography, cards and glass bottom navigation.

Dropped: the task arena feature, the starter's chat example and Room (back with Story 2.6), Robolectric,
`core/logging`, the old `Either`/`attempt` helpers (replaced by [ADR 10](0010-use-either-and-two-boundary-error-mapping.md)),
and the fastlane/Firebase distribution pipeline. CI workflows live at the workspace root because GitHub only reads
`.github/` there; the workspace pre-commit hook stays at `.githooks/`.

## Consequences

The app gets the starter's enforced structure and checks at once, with a small surface (three screens) to port. Git
history before the rebuild no longer matches the file layout. JobFlow now diverges from the starter in places (network
layer, `Either`, tabs, monorepo CI), so starter updates are ported by hand.
