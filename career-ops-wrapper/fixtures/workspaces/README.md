# Fixture Workspaces

Synthetic Career Ops workspaces for wrapper tests. Every name, company, URL,
and CV line is fake. Never copy real workspace content here.

| Fixture | Purpose |
| --- | --- |
| `valid-career-ops/`, `valid-career-ops-config-profile/` | Minimal ready workspaces |
| `missing-*` | Readiness failure cases |
| `career-ops-projection/` | Tracker, pipeline, scan history, reports, PDFs, and a deterministic `scan.mjs` for scan/offer/report/artifact tests |

Tests that run a scan copy `career-ops-projection/` to a temp directory first,
because the fixture `scan.mjs` appends to `data/`.
