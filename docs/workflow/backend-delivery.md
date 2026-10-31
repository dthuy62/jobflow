# Backend Delivery Workflow

How backend work on `career-ops-wrapper/` goes from idea to `main`. An agent
does every step; the owner reviews the finished PR and makes the decisions
listed under [Owner decisions](#owner-decisions).

## Steps

1. **Issue.** Each task is a GitHub issue labelled `backend` with acceptance
   criteria.
2. **Design.** Non-trivial tasks get a spec in `docs/superpowers/specs/`.
   Escalate to the owner only for the decisions listed below; settle
   everything else and mark it in the spec.
3. **Branch.** Cut from up-to-date `main` in its own worktree, named per
   [Branch names](#branch-names).
4. **Build.** Plan, then test-first implementation. Run `npm test`,
   `npm run build`, and a smoke run against a fixture workspace.
5. **Self-review.** Run the `review-change` skill
   (`.claude/skills/review-change/`) on the committed branch. It runs the
   machine gates and a tests-prove-the-change check, builds a tool-generated
   impact map, dispatches independent Spec, Impact, Tests and (for risk
   areas) Security reviewers, and verifies every finding by reproducing it.
   The writer fixes confirmed findings test-first, in at most three rounds,
   then escalates. Put the skill's owner report in the PR. A docs-only
   change (as the skill's impact map defines it) runs the machine gates and
   the Spec reviewer only. No external model reviews code.
6. **Pull request.** Use the PR template, link the issue, and keep the title in
   Conventional Commits form.
7. **CI.** Wait for the `Wrapper` workflow (and `Android` when contracts
   change, `Review skill` when `.claude/skills/**` changes) to pass; fix
   failures on the branch.
8. **Owner review.** Announce the PR as ready. Merge only after the owner
   approves.
9. **Merge and clean up.** Merge with a merge commit (`gh pr merge --merge`),
   delete the branch and worktree, close the issue, and update the roadmap.

## Branch names

`<type>/<kebab-case-description>`, where type is one of:

| Type | Use |
| --- | --- |
| `feature` | New behavior |
| `bugfix` | Defect fix |
| `hotfix` | Urgent fix |
| `refactor` | Restructure without behavior change |
| `design` | UI/visual change |
| `doc` | Documentation only |

Examples: `feature/wrapper-ai-evaluation`, `bugfix/scan-timeout-cleanup`.
The `Branch name` workflow fails PRs from other names and is a required
check on `main`.

## Commits and PRs

- Conventional Commits: `feat(wrapper): …`, `fix(wrapper): …`, `docs: …`.
- Authored by the repository owner only: no co-author trailers or tool
  attribution footers in commits or PR descriptions.
- `main` is protected: changes land only through PRs; no direct or force
  pushes.

## Owner decisions

Ask the owner before:

- Changing product behavior beyond the issue.
- Changing a security boundary (for example letting the wrapper invoke AI
  CLIs, adding write access, exposing new data).
- Breaking the wrapper–Android contract.
- Merging to `main`.
- Changing repository settings, secrets, or anything that costs money.

Everything else (implementation details, tests, refactors inside the scope,
review fixes, CI fixes, docs) is the agent's call.
