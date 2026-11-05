# 5. Scale structure with feature complexity

Status: Accepted (2026-10-16)

## Context

Features differ a lot. A settings toggle and a cached health check do not need the same number of layers, but a template that
always shows the heaviest shape gets copied everywhere, by people and by agents. At the same time, the direction of
dependencies is what keeps a codebase scalable, and it costs almost nothing to keep.

## Decision

The dependency direction is fixed and checked by Konsist: `ui/` does not import `data/`, `domain/` does not import
Android, Room or DataStore, and one `ui/<feature>` does not import another. How much structure sits inside that
direction is chosen per feature by the person writing it. Start at the lowest level and move up only when a concrete
pain appears, not because a pattern says so.

- **Level 0:** screen, ViewModel and a repository interface in `domain/`. The `domain/` model is also the UI model; no
  use case, no mapper. Example: `ui/settings`.
- **Level 1:** add a use case for real logic or for logic several features share; split the Room entity or DTO from the
  `domain/` model when their shapes differ. Example: `ui/home`.
- **Level 2:** value objects, invariants and aggregates in `domain/` (DDD-lite) when business rules need guarding.
- **Level 3:** extract Gradle modules (`:feature:x`, `:core:domain`, `:core:data`, `:core:ui`, `:core:common`) when build
  time, team ownership or compiler-enforced boundaries justify the cost. Use cases and repositories shared by several
  features live in `:core:domain`; features depend downward only, and cross-feature navigation stays in `:app`.

Rejected: a mandatory full stack for every feature (boilerplate with no benefit); letting `ui/` call `data/` for simple
screens (it removes fakes from tests and is expensive to unwind later); creating empty modules up front (see ADR 1).

A deliberate exception to any rule is allowed when the person owning the code decides so. Say why in a code comment, and
record an ADR if it changes a convention. A Konsist rule is changed in a reviewed change, never silenced quietly.

## Consequences

Simple screens stay small and agents get a clear default to propose, with the reason, instead of adding layers by habit.
Choosing a level is a judgement call, so reviewers ask "what pain justifies this layer?" rather than "which layers are
missing?". Moving to Level 3 is mostly moving packages, because the layout is already package-by-feature; the compiler
then enforces what Konsist enforces today.
