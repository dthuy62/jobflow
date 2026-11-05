---
created: 2026-06-28
story_key: 1-5-build-career-ops-app-shell-and-health-feedback
owner: Hy
baseline_commit: 47ac1279428c8e5e374fb036a9fcd2355a780e40
---

# Story 1.5: Build Career Ops App Shell and Health Feedback

Status: done

Owner: Hy

## Story

As a personal mobile app user,
I want a simple Career Ops app shell with best-effort health feedback,
so that I can enter the mobile workflow normally while still seeing when local setup needs attention.

## Acceptance Criteria

1. Given the user opens the app, when the main content renders, then Android shows a Career Ops app shell with three primary destinations: Home, Add, and Settings, and navigation is presented through a floating bottom navigation bar with clear active state and touch targets.
2. Given Home is selected, then the screen shows a lightweight overview with the current health summary badge and near-term Career Ops readiness context, and it does not block entry while health is loading or unhealthy.
3. Given Add is selected, then the screen reserves the workflow area for future personal scan inputs such as CV, profile, and portal/search information, and it may show a placeholder state, but must not implement CV/Profile/Portal editing in this story.
4. Given Settings is selected, then the screen shows System Health details, including wrapper reachability, workspace readiness, scanner readiness, missing requirements, last checked time, and a manual check action, and it does not expose editable URL or token fields.
5. Given the wrapper base URL is supplied by `BuildConfig.CAREER_OPS_DEFAULT_BASE_URL`, when the app enters the main shell or the user taps Check Again in Settings, then Android calls `GET /api/v1/health` and displays loading, ready, not-ready, unreachable, and invalid-response states consistently with existing visual primitives.
6. Given health was already checked during the current app session, when the user navigates before the snapshot is stale, then Android reuses the in-memory health snapshot instead of repeatedly calling the backend, and the user can force a refresh from Settings.
7. Given the last health snapshot is older than the configured freshness window, when the user re-enters the main shell or Settings, then Android may refresh health best-effort, and stale health must never enable scan-dependent actions later in the MVP.
8. Given the wrapper cannot be reached, when the health request fails due to network or timeout, then the app shows a one-time session dialog or bottom sheet summarizing wrapper unreachable status, and the user can dismiss it or open Settings to view details and retry.
9. Given the wrapper is reachable but workspace readiness fails, when the health response identifies missing workspace, invalid workspace, missing required files, command unavailable, or script failure, then the app shows a one-time session dialog or bottom sheet summarizing the highest-priority not-ready reason, Settings displays matching detailed guidance, and it does not claim Android can repair Career Ops automatically.
10. Given the wrapper and workspace are ready, when health status is displayed on Home or Settings, then the app clearly marks the connection as ready, and downstream scan actions can rely on this readiness state later.
11. Given the app is rotated or a ViewModel is recreated, when the active destination returns, then the selected destination, latest health UI state, and session dialog dismissal state survive without losing configured connection context.
12. Given visual design is reviewed, when Home, Add, Settings, health dialog, and floating bottom navigation are inspected, then the UI follows the approved soft playful mobile job-app direction with light cool-gray background, large rounded white surfaces, soft shadows, friendly bold typography, thin line icons, green/yellow/coral pastel accents, readable contrast, no neo-brutalist primitives in Career Ops feature code, and no URL/token input affordances.
13. Given Android validation runs, when this story is complete, then focused ViewModel/repository tests cover ready, not-ready, unreachable, stale-cache, force-refresh, and one-time dialog behavior, and `./gradlew testDevDebugUnitTest` passes.

## Tasks / Subtasks

- [x] Create the annotated wireframe artifact and use it as the selected implementation target. (AC: 1-4, 8-12)
  - [x] Save the wireframe under `_bmad-output/design-artifacts/story-1-5-wireframe-spec.md`.
  - [x] Implement only the selected Home/Add/Settings shell and health dialog pattern.

- [x] Add health session use case with in-memory freshness behavior. (AC: 5-7, 11, 13)
  - [x] Add a small use case that calls `JobFlowRepository.getHealth()`.
  - [x] Cache the latest health result for the current app session with a three-hour freshness window.
  - [x] Support force refresh from Settings.
  - [x] Add focused tests for ready cache reuse, stale refresh, force refresh, not-ready, and unreachable mapping.

- [x] Add Career Ops shell MVI ViewModel. (AC: 1-11, 13)
  - [x] Model Home/Add/Settings selection as UI state.
  - [x] Map health result into loading, ready, not-ready, unreachable, and invalid-response UI states.
  - [x] Emit or display the unhealthy dialog only once per app session unless force refreshed later requires visible detail in Settings.
  - [x] Preserve selected destination and dialog dismissal in ViewModel state.

- [ ] Refresh Compose shell UI direction. (AC: 1-4, 8-12)
  - [ ] Keep Home, Add, Settings, one-time health dialog, and floating bottom nav behavior.
  - [ ] Replace Career Ops shell usage of neo-brutalist primitives with soft rounded Material 3 Compose surfaces.
  - [ ] Add a reusable Flutter-inspired soft bottom nav with elastic indicator motion.
  - [ ] Keep Add as a reserved future-input area only.
  - [ ] Keep Settings free of editable URL/token fields.

- [x] Wire the shell from `MainActivity` and `AppContainer`. (AC: 5, 11)
  - [x] Provide the health use case from `AppContainer`.
  - [x] Lazily create the shell ViewModel from Compose.
  - [x] Replace the app entry content with the Career Ops shell without deleting existing Arena code.

- [x] Validate and update story record. (AC: 13)
  - [x] Run `./gradlew testDevDebugUnitTest`.
  - [x] Run `./gradlew assembleDevDebug`.
  - [x] Update Dev Agent Record, File List, Change Log, and Status.

### Review Findings

- [x] [Review][Patch] Dialog dismissal is consumed before user dismissal [android/app/src/main/java/me/dthuy/jobflow/presentation/screen/jobflow/JobFlowShellViewModel.kt:56]
- [x] [Review][Patch] Concurrent health refreshes can overwrite newer state [android/app/src/main/java/me/dthuy/jobflow/presentation/screen/jobflow/JobFlowShellViewModel.kt:51]
- [x] [Review][Patch] Settings guidance drops backend messages when missing requirements exist [android/app/src/main/java/me/dthuy/jobflow/presentation/screen/jobflow/JobFlowShellScreen.kt:216]
- [x] [Review][Patch] Health check logs success before the request completes [android/app/src/main/java/me/dthuy/jobflow/presentation/screen/jobflow/JobFlowShellViewModel.kt:49]
- [x] [Review][Patch] Detail rows can collide under large text or long status values [android/app/src/main/java/me/dthuy/jobflow/presentation/screen/jobflow/JobFlowShellScreen.kt:285]
- [x] [Review][Defer] Prod flavor points at cleartext HTTP without prod cleartext allowance [android/app/build.gradle.kts:32] — deferred, pre-existing

## Dev Notes

### Scope Boundary

Production security is out of scope. Do not add Firebase App Check, public/private key flows, cert pinning, Auth, runtime endpoint editing, token fields, endpoint lists, or settings persistence.

### Design Target

Use `_bmad-output/design-artifacts/story-1-5-wireframe-spec.md` as the shell structure target and `docs/superpowers/specs/2026-07-04-jobflow-soft-bottom-navigation-design.md` as the bottom navigation design target.

The approved direction is soft playful mobile job-app UI: light cool-gray background, large rounded white cards, soft shadows, friendly bold typography, thin line icons, green/yellow/coral pastel accents, and smooth expressive motion.

Use the Flutter bottom navigation source at `/Users/dthuy/Workspace/kollet/kollet-app/lib/features/home/widgets/bottom_navbar` as motion reference only. Preserve JobFlow destinations as Home, Add, and Settings. Do not use `NeoBrutalist.kt` primitives in Career Ops feature code.

### Current Android State

- `AppContainer` already exposes `jobFlowRepository`.
- `JobFlowRepository.getHealth()` already returns domain `Health`.
- `MainActivity` currently renders the old `ArenaScreen`; Story 1.5 should wire a new Career Ops shell and leave Arena code available for later decisions.
- Existing UI primitives live in `presentation/component/NeoBrutalist.kt`.

### Architecture Requirements

- Keep layer direction: presentation -> domain -> data.
- ViewModel should call a domain use case, not Retrofit or DTOs.
- Health cache should be app-session scoped through the container/use case, not a global singleton and not persisted.
- Android must not read Career Ops workspace files directly.
- Settings must show configured status only, not connection editing controls.

### Testing Requirements

- Use `kotlinx-coroutines-test` for ViewModel/use case tests.
- Add the smallest focused tests that prove cache freshness, force refresh, stale refresh, result mapping, and one-time dialog behavior.

## Dev Agent Record

### Implementation Plan

- Add a small session-scoped `CheckHealthUseCase` for health fetch/cache/dialog consumption.
- Add `CareerOpsShellViewModel` to map domain health into app-shell UI state.
- Add Home/Add/Settings Compose shell and wire it from `MainActivity`.

### Debug Log

- 2026-06-28: Story moved to in-progress. Starting with failing use case and ViewModel tests.
- 2026-06-28: Red phase confirmed with unresolved `CheckHealthUseCase` and `CareerOpsShellViewModel` APIs.
- 2026-06-28: Focused tests passed after adding use case, ViewModel, shell UI, and wiring.
- 2026-07-04: Reopened Story 1.5 for the soft playful UI direction and bottom navigation refresh.
- 2026-07-04: `./gradlew testDevDebugUnitTest` passed after the bottom navigation refresh.
- 2026-07-04: `./gradlew assembleDevDebug` passed after the bottom navigation refresh.

### Completion Notes

- Created the annotated mobile-first wireframe artifact for Story 1.5.
- Added session-scoped health checking with three-hour freshness, force refresh, and one-time unhealthy dialog consumption.
- Added Career Ops Home/Add/Settings shell with floating bottom navigation, Settings health details, no URL/token inputs, and existing neo-brutalist visual primitives.
- Wired `MainActivity` to the new shell while leaving Arena code in place.
- Replaced the Career Ops shell bottom navigation with a reusable soft Compose pill nav using Flutter-inspired elastic indicator motion.
- Removed neo-brutalist primitive usage from the Career Ops shell while keeping the legacy component available in the repository.

## File List

- `_bmad-output/design-artifacts/story-1-5-wireframe-spec.md`
- `_bmad-output/implementation-artifacts/1-5-build-career-ops-app-shell-and-health-feedback.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `android/app/src/main/java/me/dthuy/jobflow/AppContainer.kt`
- `android/app/src/main/java/me/dthuy/jobflow/MainActivity.kt`
- `android/app/src/main/java/me/dthuy/jobflow/domain/usecase/CheckHealthUseCase.kt`
- `android/app/src/main/java/me/dthuy/jobflow/presentation/screen/careerops/CareerOpsShellMvi.kt`
- `android/app/src/main/java/me/dthuy/jobflow/presentation/screen/careerops/CareerOpsShellScreen.kt`
- `android/app/src/main/java/me/dthuy/jobflow/presentation/screen/careerops/CareerOpsShellViewModel.kt`
- `android/app/src/test/java/me/dthuy/jobflow/careerops/CheckHealthUseCaseTest.kt`
- `android/app/src/test/java/me/dthuy/jobflow/careerops/CareerOpsShellViewModelTest.kt`

## Change Log

- 2026-06-28: Story file created from Epic 1.5 and selected wireframe requirement.
- 2026-06-28: Implemented Story 1.5 app shell and health feedback; status moved to review.
- 2026-07-04: Reopened Story 1.5 implementation for the approved soft playful UI direction and Flutter-inspired Compose bottom navigation.
- 2026-07-14: Marked Story 1.5 done after owner acceptance; implementation already committed and pushed by Hy.
