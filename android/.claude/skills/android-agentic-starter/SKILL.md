---
name: android-agentic-starter
description: Use when writing or changing app code under app/src (ViewModels, use cases, repositories, DI, navigation) or its unit tests. Not for docs, Gradle scripts or agent configuration.
---

# App code in this starter

Layers: `ui/` (Compose + ViewModel) → `domain/` (models, ports, use cases) ← `data/` (Retrofit, DataStore).
Hilt bindings live in `di/RepositoryModule.kt`.

## Pick one presentation pattern per screen

- **MVVM-lite (default):** `@HiltViewModel`, one `StateFlow<UiState>`, user actions are plain functions.
  Example: `ui/settings`.
- **MVI:** only for interdependent state, streaming or async work, or one-shot effects.
  Extend `MviViewModel<State, Intent, Effect>`. Example: `ui/home`.
- Move a screen to MVI when you would add a third boolean flag, a `SharedFlow` for events, or you hit ordering
  bugs between async calls. Never mix both in one screen.

## How much structure (the developer decides)

Dependency direction is fixed; layers inside it are not. Propose the lowest level that fits and say why:

- **0:** screen + ViewModel + repository interface, shared model, no use case or mapper (`ui/settings`).
- **1:** add a use case for real or shared logic; split entity/DTO from the domain model when shapes differ (`ui/home`).
- **2:** value objects and invariants in `domain/` when business rules need guarding.
- **3:** Gradle modules, only when build time, ownership or compiler-enforced boundaries justify it.

Logic or a repository used by several features goes in `domain/`, never inside one feature. Move up a level when a
concrete pain appears. Details and reasons: `docs/decisions/0005-scale-structure-with-feature-complexity.md`.

## Read when relevant

- Screens and UI state: `references/presentation.md`
- Repositories, use cases, errors, coroutines: `references/data-and-errors.md`
- Before reporting done: `references/review-checklist.md`

## Done means

`./gradlew assembleDevDebug testDevDebugUnitTest lintDevDebug detekt ktlintCheck` passes, and new ViewModel or use case logic
has a unit test that uses fakes.
