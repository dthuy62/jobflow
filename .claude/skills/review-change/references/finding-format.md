# Finding format (all reviewers)

Return only this, no preamble:

```
VERDICT: PASS | FINDINGS

### F<n> [CRITICAL|HIGH|MEDIUM|LOW] <one-line title>
- Location: <repo-relative path>:<line>
- Failure scenario: <concrete input or state> → <wrong output, crash, leak, or status code>
- Fix: <smallest change that removes the failure>
- Evidence: VERIFIED (<command or test you ran and what it printed>) | SUSPECTED (<why you could not run it>)
```

Severity:

- CRITICAL: workspace escape, token bypass, command execution, secret or real-path leak.
- HIGH: wrong data or a 500 on realistic input; contract break Android will hit.
- MEDIUM: failure on plausible-but-uncommon input; missing guard on a risk path.
- LOW: robustness or clarity with a concrete, if unlikely, failure.

Rules:

- One finding per root cause. No style, naming, or preference comments.
- A finding without a concrete failure scenario is not a finding; drop it.
- VERIFIED means you ran something that shows the failure (a scratch test,
  `npx tsx` script, or curl) against a copy, never against tracked files.
- Never add or edit files inside the repository: other reviewers run tests
  in the same checkout at the same time. For a scratch vitest test, make your
  own copy (`git worktree add --detach <tmp> HEAD` and symlink
  `career-ops-wrapper/node_modules`), and remove it with
  `git worktree remove --force <tmp>` when done. Scripts and fixture copies go
  in a temp directory.
