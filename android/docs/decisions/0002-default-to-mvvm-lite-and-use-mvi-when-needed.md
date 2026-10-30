# 2. Default to MVVM-lite and use MVI when needed

Status: Accepted (2026-10-15)

## Context

Screens differ: settings forms need little structure, while chat-like screens stream data, run async work and emit
one-shot events. One heavy pattern everywhere adds boilerplate; no pattern lets state drift into parallel flags.

## Decision

Every screen uses unidirectional data flow with one immutable state. MVVM-lite (`StateFlow<UiState>`, plain
functions for actions) is the default. A screen moves to MVI (`MviViewModel<State, Intent, Effect>`) when it would
need a third boolean flag, a `SharedFlow` for events, or ordering between async calls. One pattern per screen.
Rejected: MVC (Activity becomes view and controller, hard to test); MVP (a View interface per screen and manual
lifecycle, which ViewModel plus state flows replace); MVVM with many separate flows (drifts into inconsistent state).

## Consequences

Simple screens stay small and complex screens get explicit intents and effects. Reviewers must check that the MVI
rule, not habit, drives the choice.
