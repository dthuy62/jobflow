# Development roadmap

Product stories and their status live in `../../_bmad-output/implementation-artifacts/sprint-status.yaml`. This file
tracks the Android engineering baseline only.

## Complete

- [x] Rebuilt on android-agentic-starter: Hilt, Navigation 3, Konsist, detekt, ktlint, docs checks
      ([ADR 8](decisions/0008-rebuild-jobflow-android-from-starter.md))
- [x] Retrofit + kotlinx.serialization network layer with wrapper contract tests
      ([ADR 9](decisions/0009-retrofit-kotlinx-serialization-network-layer.md))
- [x] `Either<AppError, T>` error model with source and UI mappers and a mirrored `ApiErrorCode`
      ([ADR 10](decisions/0010-use-either-and-two-boundary-error-mapping.md))
- [x] Health on Home and Settings with a three-hour cache and a show-once unhealthy dialog
- [x] Root CI workflows for Android and the wrapper

## Next

- [ ] Story 2.5: CV and profile editing (first `FeatureError`, e.g. validation)
- [ ] Story 2.6: Room 3 cache with stale-while-error state and a `toLocalError()` mapper
- [ ] Stories 3.3 and 3.5: portal editing and scan readiness
- [ ] Install and smoke-test a minified release build (R8 is on, `proguard-rules.pro` is empty)
- [ ] Epic 7: production endpoint, HTTPS, pairing token storage
- [ ] More Konsist rules: `domain/` must not import `ui/` or `data/`, `data/` must not import `ui/`

## Dependency note

detekt is on 1.23.8 while the project uses a much newer Kotlin; it works today. Check it again whenever Kotlin is
upgraded.
