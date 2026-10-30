# 1. Use a single app module

Status: Accepted (2026-10-15)

## Context

The starter must be quick to build, easy to read in one sitting, and easy for coding agents to navigate.
Multi-module setups add build logic, convention plugins and longer sync times before a project has any features.

## Decision

Keep one Gradle module, `:app`, organized by package: `ui/`, `domain/`, `data/`, `di/`, `navigation/`,
`core/`. Layer boundaries are enforced by review, `AGENTS.md` and Konsist architecture tests, not by the compiler.
Rejected: feature modules from day one (cost before benefit).

## Consequences

Builds and onboarding stay simple. The compiler does not stop a `ui/` file from importing `data/`, so automated
checks must. The package split matches how the app would be cut into modules if a team later needs them.
