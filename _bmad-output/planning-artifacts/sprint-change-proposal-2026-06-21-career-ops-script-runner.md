# Sprint Change Proposal: Career Ops Script Runner Execution Strategy

Date: 2026-06-21
Status: Approved
Mode: Batch
Scope: Minor direct adjustment

## 1. Issue Summary

Before creating Story 1.3, implementation discussion clarified that Career Ops has two distinct execution paths:

- Local Node.js scripts in the Career Ops Workspace, including `scan.mjs` / `npm run scan`.
- AI CLI or provider API-key workflows, including Antigravity/Claude/Gemini/Codex slash commands and standalone evaluator scripts such as `gemini-eval.mjs`.

The original planning language correctly required real Career Ops scan execution, but it did not name the MVP execution path explicitly enough. This created a risk that downstream stories would assume scans require an AI CLI session or a provider API key.

Evidence from the real `/Users/dthuy/Workspace/career-ops` workspace:

- `package.json` exposes `scan: node scan.mjs`.
- Career Ops documentation and local files describe `scan.mjs` as a zero-token portal scanner.
- `gemini-eval.mjs` requires `GEMINI_API_KEY` and is therefore a different, optional provider path.
- Antigravity CLI onboarding works well interactively, but backend slash-command automation still needs a separate headless/non-interactive spike.

## 2. Impact Analysis

### Epic Impact

Epic 1 remains valid, but Story 1.3 should include script readiness in health/workspace readiness:

- `doctor.mjs`
- `scan.mjs`
- `portals.yml`
- command runner readiness

Epic 4 remains valid, but scan execution must be specified as an allowlisted local script runner call, not AI CLI slash-command automation and not an API-key evaluator.

No epic needs to be removed or redesigned.

### Story Impact

Affected stories:

- Story 1.3: add scanner script readiness checks to health/readiness.
- Story 3.4: scan readiness should include local script readiness, not provider API-key readiness.
- Story 4.1: `runScan()` should map to `node scan.mjs` or equivalent `npm run scan` inside the configured Career Ops Workspace.
- Story 4.5 and 4.6: logs/evidence should describe the local script runner and zero-token scan path.

### Artifact Conflicts

Architecture needed clearer wording around:

- no user-configurable command path;
- typed operations mapping to fixed scripts;
- AI CLI slash-command workflows deferred;
- API-key evaluator scripts optional/future because of cost/token concerns.

Epics needed matching story-level language so future stories inherit the correct execution path.

PRD did not require a rewrite. It already states the product goal at the right level: real Career Ops scripts and real files, no generic command execution, and Gemini/API evaluation optional/future.

### Technical Impact

Backend implementation should introduce a `CareerOpsScriptRunner` or equivalent inside the `career-ops-engine` boundary:

- `doctor` -> `node doctor.mjs`
- `scan` -> `node scan.mjs` or equivalent `npm run scan`
- future allowlisted operations only as explicitly promoted by stories

The runner must set `cwd` to the configured Career Ops Workspace, capture stdout/stderr, enforce timeout and single-active-scan rules, and redact sensitive values.

## 3. Recommended Approach

Recommended path: Direct Adjustment.

Rationale:

- MVP value is preserved: Android can still start real job scans.
- Cost risk is reduced: MVP scan path is zero-token and does not require provider API keys.
- Architecture remains simple: typed scan endpoint -> allowlisted local script -> parse workspace outputs.
- AI CLI/API-key paths remain available later without blocking the core scan/offers MVP.

Effort estimate: Low.

Risk level: Low.

Timeline impact: No meaningful delay; this correction should make Story 1.3 and Epic 4 cleaner.

## 4. Detailed Change Proposals

### Architecture

Updated architecture to state:

- MVP scan execution uses `node scan.mjs` or equivalent `npm run scan` inside the configured Career Ops Workspace.
- This scan path is zero-token and does not require Gemini/OpenAI/Anthropic API keys.
- The wrapper must not expose a user-configurable Career Ops command path.
- Command allowlist maps typed backend operations to fixed scripts.
- Native AI CLI slash-command workflows are deferred until a headless/non-interactive spike proves them.
- Standalone API-key evaluator scripts such as `gemini-eval.mjs` are optional future provider mode with cost controls.

### Epics / Stories

Updated epics to state:

- `runScan()` must execute the local Career Ops script runner.
- Story 1.3 health/readiness should check `doctor.mjs`, `scan.mjs`, `portals.yml`, and command runner readiness.
- Story 4.1 scan start must not use AI CLI slash-command automation or provider API-key evaluator scripts for MVP.
- Scan adapter definition must include fixed script mapping, cwd, args, timeout, stdout/stderr capture, and redaction.

### Deferred Work

Added deferred notes for:

- Antigravity/Claude/Gemini/Codex/OpenCode/Qwen headless/non-interactive spike.
- Optional provider API-key evaluator mode with explicit budget/cost controls.

## 5. Implementation Handoff

Scope classification: Minor.

Route to: Developer agent.

Next implementation implications:

- Create Story 1.3 with scanner script readiness in health/workspace readiness.
- Keep `capabilities.scan` false until scan-run endpoint exists, or represent script readiness separately from API capability.
- Do not implement AI CLI automation or API-key evaluator automation in Story 1.3.
- Use this correction as downstream context when creating Story 4.1.

## 6. Checklist Summary

- [x] Trigger understood: uncertainty around whether backend scan execution requires AI CLI or API key.
- [x] Evidence gathered: real Career Ops workspace exposes `scan: node scan.mjs`; API-key evaluator is separate.
- [x] Epic impact assessed: no redesign; Story 1.3 and Epic 4 wording updated.
- [x] Architecture impact assessed: command runner boundary clarified.
- [x] PRD impact assessed: no rewrite required.
- [x] Recommended path selected: direct adjustment.
- [x] Artifacts updated: Architecture, Epics, Deferred Work.

## 7. Approval and Handoff

Approved by user request in batch mode.

Success criteria:

- Story 1.3 includes script readiness.
- Future scan execution stories use the zero-token local script runner.
- AI CLI/API-key integrations remain deferred unless explicitly promoted by a later story.
