---
title: Sprint Change Proposal - Local Pairing Token Terminology
status: applied
created: 2026-06-21
project: task-arena
change_scope: minor
recommended_route: direct_adjustment
---

# Sprint Change Proposal: Local Pairing Token Terminology

## 1. Issue Summary

During preparation for Story 1.2, the security terminology around LAN access was found to be technically correct but product-confusing. The planning artifacts currently mix "pairing token", "API key", "bearer token", and `Authorization: Bearer <token>` language for a personal local-first wrapper backend.

This can mislead future implementation work in three ways:

- It may imply user authentication, account login, or cloud identity, which the MVP explicitly does not include.
- It may imply a public API key model, which is too broad for a personal LAN wrapper.
- It may invite unnecessary Firebase App Check work before the wrapper is deployed as a public or cloud backend.

The intended MVP concept is simpler: a local shared secret used only when the wrapper is reachable beyond localhost.

## 2. Impact Analysis

### Epic Impact

Epic 1 remains valid and should continue as planned. No epic needs to be added, removed, renumbered, or resequenced.

Affected Epic 1 stories:

- Story 1.2: runtime configuration and workspace boundary must use the Local Pairing Token concept.
- Story 1.4: Android connection settings must store the wrapper base URL plus optional Local Pairing Token.
- Story 1.5: setup UI should label the token as a Local Pairing Token, not a bearer token or API key.

Future epics are only affected through consistent redaction terminology. Where artifacts mention bearer tokens or API keys as sensitive values, they should instead refer to local pairing tokens, provider API keys, or generic secrets depending on context.

### Story Impact

Story 1.1 is complete. It only needs light terminology consistency in the scaffold where existing code currently references `CAREER_OPS_API_TOKEN` or "bearer token" in examples. No Story 1.1 rollback is required.

Story 1.2 should be created after this correction is applied so it inherits the final naming:

- Concept: Local Pairing Token
- Environment variable: `CAREER_OPS_PAIRING_TOKEN`
- Header: `X-Career-Ops-Token`
- Localhost mode: token may be omitted
- LAN/private network mode: token is required

### Artifact Conflicts

PRD:

- MVP connection modes and NFR-6 currently say "pairing token or API key".
- These should be tightened to "Local Pairing Token" for LAN/private network access.

PRD Addendum:

- Resolved MVP defaults currently say physical phone LAN access requires a pairing token or API key.
- This should be updated to Local Pairing Token.

Architecture:

- Several sections use `token/API key`, "bearer token", and `Authorization: Bearer <token>`.
- API header definition should change to `X-Career-Ops-Token: <token>`.
- Runtime config should refer to `CAREER_OPS_PAIRING_TOKEN`, not `CAREER_OPS_API_TOKEN`.
- Firebase App Check should be explicitly deferred/non-MVP for this local-first personal wrapper.

Epics:

- Requirements inventory, Story 1.2, Story 1.4, Story 1.5, and redaction criteria should use Local Pairing Token terminology.
- Android connection settings should rename `bearerToken` to `pairingToken`.

Implementation scaffold:

- `career-ops-wrapper/src/config/env.ts` should read `CAREER_OPS_PAIRING_TOKEN`.
- `career-ops-wrapper/src/security/redaction.ts` should redact `CAREER_OPS_PAIRING_TOKEN=...` and `X-Career-Ops-Token` values.
- `career-ops-wrapper/contracts/examples/errors/unauthorized.json` should say a valid local pairing token is required.

### Technical Impact

This is a naming and API contract clarification, not a new security system. The wrapper still uses a simple shared-secret check for protected LAN/private routes. It does not introduce accounts, Firebase Admin SDK, Firebase App Check verification, token rotation, device registry, database storage, or cloud identity.

No architecture re-creation is required.

## 3. Recommended Approach

Recommended path: Direct Adjustment.

Effort: Low.

Risk: Low if applied before Story 1.2 is created.

Rationale:

- The product goal stays the same: no user authentication, local-first privacy, LAN protection when the wrapper is reachable from a physical phone.
- The technical mechanism becomes clearer and smaller.
- Story 1.2 can then implement the final contract without carrying old wording forward.
- Firebase App Check remains a valid future option for public/cloud deployment, but it is not needed for the personal LAN MVP.

Rejected alternatives:

- Keep "API key": too broad and easy to confuse with provider API keys such as `GEMINI_API_KEY`.
- Keep `Authorization: Bearer`: technically familiar but implies a bearer auth model and adds conceptual weight for a local pairing secret.
- Add Firebase App Check now: over-scoped for a personal local-first wrapper and requires Firebase project/admin setup before the MVP needs it.

## 4. Detailed Change Proposals

### PRD

Section: MVP Connection Modes

OLD:

```md
- Physical Android device to Wrapper Backend over trusted LAN using a pairing token or API key.
```

NEW:

```md
- Physical Android device to Wrapper Backend over trusted LAN using a Local Pairing Token.
```

Section: NFR-6

OLD:

```md
- **NFR-6: Local-First Security.** Wrapper Backend binds to localhost by default; LAN/private access requires a pairing token or API key.
```

NEW:

```md
- **NFR-6: Local-First Security.** Wrapper Backend binds to localhost by default; LAN/private access requires a Local Pairing Token. This token is not user authentication, not a public API key, and not account login.
```

### PRD Addendum

OLD:

```md
- Physical phone LAN access requires a pairing token or API key.
```

NEW:

```md
- Physical phone LAN access requires a Local Pairing Token.
```

### Architecture

Replace general security wording:

OLD:

```md
Physical phone LAN mode requires a pairing token or API key.
Local-First Security requires localhost default and LAN pairing token/API key.
LAN token/API key header: `Authorization: Bearer <token>`
```

NEW:

```md
Physical phone LAN mode requires a Local Pairing Token.
Local-First Security requires localhost default and a Local Pairing Token for LAN/private network access.
LAN/private access header: `X-Career-Ops-Token: <token>`
```

Replace runtime/config references:

OLD:

```md
LAN token/API key
bearer token
`CAREER_OPS_API_TOKEN`
```

NEW:

```md
Local Pairing Token
local pairing token
`CAREER_OPS_PAIRING_TOKEN`
```

Add explicit non-MVP clarification:

```md
Firebase App Check is deferred for MVP. It may be reconsidered if the wrapper is deployed as a public/cloud backend, but the personal LAN MVP uses a Local Pairing Token instead of Firebase Admin SDK verification.
```

### Epics / Stories Planning Doc

Story 1.2 acceptance criteria:

OLD:

```md
**Then** the backend requires `Authorization: Bearer <token>` according to runtime security settings
```

NEW:

```md
**Then** the backend requires `X-Career-Ops-Token: <token>` according to runtime security settings
```

Story 1.4 Android connection settings:

OLD:

```md
WrapperConnectionSettings(baseUrl, bearerToken)
```

NEW:

```md
WrapperConnectionSettings(baseUrl, pairingToken)
```

Story 1.5 setup UI:

OLD:

```md
optional bearer token input
```

NEW:

```md
optional Local Pairing Token input
```

### Current Wrapper Scaffold

Config:

OLD:

```ts
CAREER_OPS_API_TOKEN
apiToken
```

NEW:

```ts
CAREER_OPS_PAIRING_TOKEN
pairingToken
```

Error example:

OLD:

```json
"message": "A valid bearer token is required."
```

NEW:

```json
"message": "A valid local pairing token is required."
```

Redaction:

OLD:

```ts
Bearer ...
CAREER_OPS_API_TOKEN=...
```

NEW:

```ts
X-Career-Ops-Token: ...
CAREER_OPS_PAIRING_TOKEN=...
```

## 5. Implementation Handoff

Scope classification: Minor.

Route to: Developer agent for direct implementation.

Responsibilities:

- Update PRD, PRD Addendum, Architecture, and Epics terminology.
- Update Story 1.1 only where current scaffold terminology would conflict with Story 1.2.
- Update the existing backend scaffold naming and contract example.
- Run search verification to ensure non-provider "API key", "bearer token", `Authorization: Bearer`, and `CAREER_OPS_API_TOKEN` references are removed or intentionally preserved only for external provider keys such as `GEMINI_API_KEY`.
- Run `npm test` and `npm run build` in `career-ops-wrapper`.

Success criteria:

- Planning artifacts consistently use Local Pairing Token for LAN/private wrapper access.
- API contract consistently uses `X-Career-Ops-Token`.
- Runtime config consistently uses `CAREER_OPS_PAIRING_TOKEN`.
- Firebase App Check is documented as non-MVP/deferred, not part of Story 1.2.
- No epic/story sequence changes are required.

## 6. Checklist Completion

- [x] 1.1 Triggering story identified: Story 1.2 preparation after Story 1.1 completion.
- [x] 1.2 Core problem defined: terminology/security model confusion, not a scope pivot.
- [x] 1.3 Evidence gathered: PRD, Addendum, Architecture, Epics, and wrapper scaffold contain mixed token/API key/bearer wording.
- [x] 2.1 Current epic remains completable.
- [x] 2.2 No epic scope redesign required.
- [x] 2.3 Future epics require terminology consistency only.
- [x] 2.4 No epics invalidated and no new epics needed.
- [x] 2.5 Epic order and priority remain unchanged.
- [x] 3.1 PRD conflicts identified.
- [x] 3.2 Architecture conflicts identified.
- [N/A] 3.3 UI/UX spec conflict beyond setup label wording.
- [x] 3.4 Secondary implementation scaffold updates identified.
- [x] 4.1 Direct Adjustment is viable; effort low, risk low.
- [x] 4.2 Rollback is not viable or necessary.
- [x] 4.3 MVP review is not required.
- [x] 4.4 Recommended path selected: Direct Adjustment.
- [x] 5.1 Issue summary created.
- [x] 5.2 Epic/artifact adjustment needs documented.
- [x] 5.3 Recommended path documented.
- [x] 5.4 MVP impact documented: no MVP scope change.
- [x] 5.5 Handoff plan established.
- [x] 6.1 Checklist reviewed.
- [x] 6.2 Proposal reviewed for actionability.
- [x] 6.3 User approval received on 2026-06-21.
- [N/A] 6.4 Sprint status update not required because no epic/story entries are added, removed, or resequenced.
- [x] 6.5 Next steps and handoff plan documented.

## 7. Approval

Status: Approved by user and applied on 2026-06-21.

Applied artifacts:

- PRD
- PRD Addendum
- Architecture
- Epics / stories planning document
- Story 1.1 terminology notes
- Current wrapper scaffold config/redaction/error example

Verification:

- Search check found no remaining wrapper-security references to `CAREER_OPS_API_TOKEN`, `Authorization: Bearer <token>`, `bearerToken`, or "pairing token or API key" in the corrected scope.
- `npm test` passed in `career-ops-wrapper`.
- `npm run build` passed in `career-ops-wrapper`.

Next step: create Story 1.2 from the corrected planning baseline.
