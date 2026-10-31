# Owner report template (Layer 5)

Paste into the PR description under "Decisions for the reviewer" and
"Verification", or post as a PR comment. Keep it under one screen.

```
## Review: <base>..<head>

Risk: LOW | MEDIUM | HIGH — <one sentence why>
Components: <wrapper, contracts, android, docs>
Gates: <each gate> PASS/FAIL; tests-prove-change: <n> failed without change, <n> new tests prove nothing
Impact: <changed routes/schemas/contracts>; Android DTOs touched: <yes/no, which>
Tier: S | M | L — <reasons from the impact map>
Reviewers run: spec | standard | spec, impact, tests[, security]
Fix rounds: <n>/<1 for S and M, 3 for L>
Follow-ups (LOW, not fixed): <list or "none">

| ID | Severity | Status | Location | Summary |
| --- | --- | --- | --- | --- |
| F1 | MEDIUM | fixed (test: <name>) | path:line | ... |
| F2 | LOW | suspected, not fixed | path:line | ... |
| F3 | HIGH | disproved, dropped | path:line | ... |

Decisions made without the owner: <list or "none">
Needs the owner: <open questions, escalations, or "nothing">
```

Status values: fixed, confirmed-open, suspected, disproved, won't fix
(with reason), escalated.
