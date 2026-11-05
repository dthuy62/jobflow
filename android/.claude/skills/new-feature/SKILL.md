---
name: new-feature
description: Use when adding a new screen or feature under ui/ in this Android starter, from scaffolding to navigation and tests.
---

# Add a screen

1. Run `scripts/new-feature.sh <name>` (lowercase letters and digits). It creates `ui/<name>/` with
   `<Name>Route`, an MVVM-lite `<Name>ViewModel`, `<Name>Screen` + `<Name>Content`, and a starter
   `<Name>ViewModelTest`. Add `--mvi` for an `MviViewModel` with a `<Name>Contract` file instead.
2. Register it in `navigation/NavGraph.kt`: add `entry<<Name>Route> { <Name>Screen(...) }` (and a `TopLevelTab` entry if it is a tab)
   and pass any other navigation as callbacks. The new screen never imports another feature.
3. Keep MVVM-lite unless the MVI rule in skill `android-agentic-starter` applies. Pick the lowest structure level that
   fits (see "How much structure" there): a simple feature injects a domain repository interface directly, with no use
   case or mapper. Logic shared with another feature goes in `domain/`, not in either feature.
4. Extend the generated `ui/<name>/<Name>ViewModelTest.kt` with fakes of domain interfaces and `Dispatchers.setMain`
   (shared fakes live in the test `testing` package, e.g. `FakeHealthRepository`).
5. Put user-facing text in `res/values/strings.xml`.
6. Run `./gradlew assembleDevDebug testDevDebugUnitTest lintDevDebug detekt ktlintCheck`.
