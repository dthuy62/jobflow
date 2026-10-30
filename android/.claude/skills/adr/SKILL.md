---
name: adr
description: Use when making, recording, questioning or replacing an architecture decision in this repo, or when asked to write an ADR.
---

# Architecture decision records

ADRs live in `docs/decisions/`. Read the relevant ones before proposing a change to architecture.

## Write one when

- the decision changes structure, layers, dependencies or a public convention, or is costly to reverse;
- someone later will ask "why is it like this?".

Skip it for style choices a linter covers, one-file details, and temporary workarounds.

## How

1. Next number: highest `NNNN` in `docs/decisions/` plus one, four digits.
2. File name: `NNNN-<present-tense-verb-phrase>.md`, lowercase kebab-case (`0005-add-a-network-layer.md`).
3. Fill `references/template.md`: one decision per file; Context states the forces, Decision states the choice
   plainly, Consequences lists what gets easier and what gets harder.
4. Status line: `Status: Accepted (YYYY-MM-DD)` once agreed, `Proposed (YYYY-MM-DD)` before.
5. Never rewrite an accepted ADR. To change course, write a new ADR and set the old one's status to
   `Status: Superseded by NNNN`.
6. If a guide in `docs/` (for example `system-architecture.md` or `code-standards.md`) describes the affected area,
   link the ADR from there.
