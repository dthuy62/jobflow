# Owner report template (Layer 5)

Paste into the PR description under "Decisions for the reviewer" and
"Verification", or post as a PR comment. Keep it under one screen.

```
## Review: <base>..<head>

Risk: LOW | MEDIUM | HIGH — <one sentence why>
Components: <wrapper, contracts, android, docs>
Gates: <each gate> PASS/FAIL; tests-prove-change: <n> failed without change, <n> new tests prove nothing
Impact: <changed routes/schemas/contracts>; Android DTOs touched: <yes/no, which>
Reviewers run: spec, impact, tests[, security][, second-model: gemini]
Fix rounds: <n>/3

| ID | Severity | Status | Location | Summary |
| --- | --- | --- | --- | --- |
| F1 | MEDIUM | fixed (test: <name>) | path:line | ... |
| F2 | LOW | suspected, not fixed | path:line | ... |
| F3 | HIGH | not reproduced, dropped | path:line | ... |

Decisions made without the owner: <list or "none">
Needs the owner: <open questions, escalations, or "nothing">
```

Status values: fixed, confirmed-open, suspected, not reproduced, won't fix
(with reason), escalated.
