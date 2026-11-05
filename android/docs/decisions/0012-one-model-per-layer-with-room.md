# 12. One model per layer, with Room as what screens read

Status: Accepted (2026-11-04)

## Context

The local database needs a shape before phase 2 builds on it. A single table of raw JSON per user and key needs no
migrations, but it cannot be queried, cannot join a tracker status to a feed, and cannot hold an offline change to retry.

## Decision

- Separate models: DTO for the wire, entity for the table, domain for logic, UI state for the screen. Mappers live in
  `data/` beside the entity, and in `ui/<feature>` for UI state; `domain/` knows no other layer.
- Names follow the thing, not the mechanism: `JobEntity`, `FeedItemEntity`, `FeedDao`.
- A cached feature's screen observes Room, and a refresh only writes to Room. Uncached data goes straight to domain.
- A job is public and shared between users, and a feed item belongs to one user, with its id in the key.

## Consequences

- A new column needs a schema change, which is cheap because the cache can be dropped and rebuilt.
- Every cached feature writes mappers and adds a table.
- Rejected: storing raw JSON, for the reasons above.
