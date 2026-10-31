---
name: review-change
description: Use when a JobFlow change (career-ops-wrapper, contracts, or Android) is ready for self-review before a PR, when re-reviewing review fixes, or when asked to review a branch, commit range, or PR in this repository.
---

# Review a JobFlow change

## Overview

**The writer doesn't review. The reviewer doesn't write.** You, the session
that wrote the change, only orchestrate: run tools, dispatch fresh reviewers,
verify their findings, and fix what is confirmed. You never add your own
findings and never argue a finding away; a verifier decides.

Impact comes from tools first (Layer 1), judgment second (Layer 2). Every
finding is reproduced before anyone fixes it (Layer 3).

A full run costs about five single-reviewer reviews (see `EVALUATION.md`).
The impact map, not your sense of the change's size, decides which reviewers run.

## Docs-only light mode

When the impact map says `Mode: docs-only`, run Layer 0 and the Spec reviewer
only (no Impact or Tests reviewer), then Layers 3–5 for its findings as usual.
The script decides, not you. A change is docs-only when every changed path
(including the old path of a rename) is documentation:

- a `.md` file anywhere, or any file under `docs/`;
- but never agent instructions (`AGENTS.md`, `CLAUDE.md`, or a file under
  any `.claude/` directory), a file under any `.github/` directory
  (workflows, PR template), or a file under any `src/` or `contracts/`
  directory (shipped content and contract examples).

One non-documentation file in the diff means a full run.

## Setup

1. Commit the change (a WIP commit is fine). Reviewers read git, not your
   working tree.
2. `BASE=$(git merge-base origin/main HEAD)`, `HEAD=$(git rev-parse HEAD)`.
3. Find the spec: the issue text and/or `docs/superpowers/specs/*.md`.
4. Make a scratch dir for outputs (`$SCRATCH`). Nothing below writes to the repo.

## Layer 0: machine gates

```bash
node .claude/skills/review-change/scripts/impact-map.mjs --base $BASE > $SCRATCH/impact.md
```

The map needs the wrapper's TypeScript compiler: run `npm ci` in
`career-ops-wrapper/` first (exit 2 says so when it is missing).

Run every command under "Layer 0 gates" in `impact.md` (wrapper:
`npm test && npm run build`; Android when `android/**` or `contracts/**`
change: `./gradlew testDevDebugUnitTest lintDevDebug detekt ktlintCheck`).
A failing gate is not a review finding: fix it and start again.

Then, for wrapper source changes:

```bash
node .claude/skills/review-change/scripts/tests-prove-change.mjs --base $BASE > $SCRATCH/prove.md
```

It reverts `career-ops-wrapper/src/**` to `$BASE` in a throwaway worktree and
re-runs the added/changed tests. New tests that still pass prove nothing; the
Tests reviewer judges each one. Android has no automated equivalent: the Tests
reviewer checks Android tests by reading them.

## Layer 1: impact map

`impact.md` from Layer 0 lists changed files, routes, symbols with every
`git grep` reference (wrapper, tests, Android, docs), Zod schema → Android DTO
matches, contract examples and their users, workspace path literals, risk
areas with the question each must answer, and **Mandatory reviewers**.

TypeScript and JavaScript symbols come from the TypeScript compiler: a
changed line belongs to the top-level declaration whose span, including the
comments above it, contains it (added lines in the head tree, removed lines
in the base tree). Changes to statements that declare nothing, such as calls
and imports, have no symbol. Kotlin symbols are still matched line by line.

## Layer 2: independent reviewers

Dispatch every mandatory reviewer **in one message** as parallel `Agent`
calls (`subagent_type: general-purpose`). Each prompt is exactly:

```
Your role instructions are in <abs path>/references/reviewer-<role>.md and
the output format in <abs path>/references/finding-format.md. Read both
first and follow them exactly.
Placeholder values:
- {{REPO}} = <abs repo path>
- {{BASE}} = <sha>   {{HEAD}} = <sha>
- <only the placeholders that role file uses: {{SPEC_PATH}}, {{IMPACT_MAP}}, {{PROVE_RESULT}}>
Do not invoke skills.
```

| Role | File | Runs |
| --- | --- | --- |
| Spec | `reviewer-spec.md` | always |
| Impact | `reviewer-impact.md` | full mode |
| Tests | `reviewer-tests.md` | full mode |
| Security | `reviewer-security.md` | when listed in Mandatory reviewers |

A reviewer prompt contains: the role file, the paths, the format. It does not
contain your summary of the change, your design reasons, what you already
checked, or what you expect them to find.

Android diffs: the Impact reviewer also gets
`android/.claude/skills/android-agentic-starter/references/review-checklist.md`.

## Layer 3: verification

Merge duplicate findings (same root cause). For each finding, dispatch a
verifier (`references/verifier.md`, parallel, one finding each, or one per
file when there are many). Outcomes:

- CONFIRMED: goes to Layer 4 with its reproduction.
- SUSPECTED (no reproduction could be built, or the attempt did not show the
  failure): stays open, reported to the owner, not fixed unless trivial and safe.
- DISPROVED (the verifier showed the claimed failure cannot happen): dropped,
  listed in the report with the evidence.

## Layer 4: bounded fix loop

You (the writer) fix CONFIRMED findings test-first: the verifier's
reproduction becomes the failing test, then the fix. Commit, then re-run
Layers 0–3 on the fix diff only (`--base <head before fixes>`). At most 3
rounds; after round 3, stop and escalate open findings to the owner.

## Layer 5: owner report

Fill `references/owner-report.md` and put it in the PR (Decisions for the
reviewer / Verification) or a PR comment.

## Red flags: stop

| Thought | Reality |
| --- | --- |
| "I'll just review it myself, it's small" | You are the writer. Dispatch reviewers. |
| "Security isn't needed, the change is harmless" | If the map lists it, it runs. |
| "This finding is obviously right, skip verification" | Unverified findings cause wrong fixes. Verify. |
| "This finding is wrong, I'll drop it" | Only a verifier drops findings. |
| "I'll give the reviewer context so it's faster" | Context from the writer anchors the reviewer. Paths only. |
| "Round 4 will fix it" | Three rounds, then escalate. |
| "It's mostly docs, light mode is enough" | Only `Mode: docs-only` in the map allows it. |

## Common mistakes

- Reviewing uncommitted work: scripts read git; commit first.
- Running reviewers one after another: send all `Agent` calls in one message.
- Treating "existing tests still pass" as a defect: only NEW tests that pass
  without the change are suspicious, and regression guards are fine.
- Scratch tests inside the shared checkout: parallel reviewers then run each
  other's failing probes. Reviewers and verifiers use their own worktree copy.
- Treating spec divergences as bugs to fix silently: a verified "the code
  does more or less than the spec" goes to the owner as a decision.
