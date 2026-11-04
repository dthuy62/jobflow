# 11. Move the app from the wrapper to the hosted API

Status: Accepted (2026-11-04)

## Context

The product is now hosted (`../../../docs/superpowers/specs/2026-11-02-jobflow-hosted-product-design.md`), so the app
stops talking to a local wrapper over a Career Ops workspace.

## Decision

- The contract is root `contracts/`. DTOs, error codes and contract tests follow it, and the `dev` flavor points at its
  mock. No screen depends on a workspace any more.
- Health answers 503 with a normal body when a dependency is down. That is an answer, so `healthOrThrow` reads it
  instead of letting it become an error.
- The pairing token goes now and the bearer token arrives with the auth layer: health is public, and the only call
  the app makes today.
- `prod` points at `https://api.jobflow.invalid` until a production endpoint exists, so it can reach nothing by accident.

## Consequences

- The app no longer runs against the wrapper, which stays a development and self-host tool.
- DTOs no screen reads yet stay as plain strings in `ContractDtos.kt`, checked against every example, until a feature
  maps them.
