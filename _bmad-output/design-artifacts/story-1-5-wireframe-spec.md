# Story 1.5 Wireframe Spec: Career Ops App Shell and Health Feedback

## Frame

- Surface: Android mobile app shell with Home, Add, Settings, health dialog, and floating bottom navigation.
- Viewport assumption: 360 x 800 dp mobile-first; tablet scales by widening content columns only.
- Fidelity: annotated mid-fi wireframe.
- Style direction: soft playful mobile job-app UI with light cool-gray background, large rounded white surfaces, soft shadows, friendly bold typography, thin line icons, green/yellow/coral pastel accents, and a Flutter-inspired elastic floating bottom nav. No URL/token inputs.

## Wireframe

### Home

```text
┌────────────────────────────────────┐
│ [1] JOBFLOW / CAREER OPS           │
│     Local workflow console         │
├────────────────────────────────────┤
│ [2] SYSTEM HEALTH  [READY|CHECKING]│
│     Last checked: HH:mm            │
│     Missing: none / top issue      │
├────────────────────────────────────┤
│ [3] NEXT ACTION                    │
│     Add personal scan inputs       │
│     [Open Add]                     │
├────────────────────────────────────┤
│ [4] READINESS SNAPSHOT             │
│     Workspace  Ready/Needs setup   │
│     Scanner    Ready/Needs setup   │
│                                    │
│                                    │
│                                    │
├──────────── floating nav ──────────┤
│        [HOME]   [+]   [SETTINGS]   │
└────────────────────────────────────┘
```

### Add

```text
┌────────────────────────────────────┐
│ [1] ADD                            │
│     Personal scan inputs           │
├────────────────────────────────────┤
│ [2] CV                             │
│     Placeholder: future editor     │
├────────────────────────────────────┤
│ [3] PROFILE                        │
│     Placeholder: future editor     │
├────────────────────────────────────┤
│ [4] PORTALS                        │
│     Placeholder: future editor     │
│                                    │
├──────────── floating nav ──────────┤
│        [HOME]   [+]   [SETTINGS]   │
└────────────────────────────────────┘
```

### Settings

```text
┌────────────────────────────────────┐
│ [1] SETTINGS                       │
│     System health                  │
├────────────────────────────────────┤
│ [2] STATUS                         │
│     Ready / Not ready / Unreachable│
│     Last checked: HH:mm/server time│
│     [Check Again]                  │
├────────────────────────────────────┤
│ [3] DETAILS                        │
│     Wrapper: reachable/unreachable │
│     Workspace: ready/missing/etc   │
│     Scanner: ready/not ready       │
├────────────────────────────────────┤
│ [4] GUIDANCE                       │
│     Missing requirements/messages  │
│     No auto-repair claim           │
├──────────── floating nav ──────────┤
│        [HOME]   [+]   [SETTINGS]   │
└────────────────────────────────────┘
```

### Health Dialog

```text
┌────────────────────────────────────┐
│ [1] LOCAL SETUP NEEDS ATTENTION    │
│ [2] Wrapper unreachable / top issue│
│ [3] [Dismiss]        [Settings]    │
└────────────────────────────────────┘
```

## Annotations

1. Header loads immediately from static app copy; health must not block the shell.
2. Health badge is API-backed from `GET /api/v1/health`; show checking, ready, not ready, unreachable, or invalid response.
3. Home primary action navigates to Add only. It must not start scans in Story 1.5.
4. Add is a placeholder for future CV/Profile/Portal inputs; no editors, persistence, or wrapper writes.
5. Settings owns detailed health and manual refresh. There are no editable base URL or token fields.
6. Floating nav has three targets, visible active state, 48 dp minimum touch targets, and bottom content padding so scroll content is never hidden.
7. Dialog appears once per app session for unreachable or not-ready health. Dismissal survives ViewModel recreation through the app-session use case state.

## Content Specs

- H1: 1-3 words per screen.
- Status copy: one short sentence, 80 characters max.
- Guidance: top missing requirement first, then backend messages if present.
- Data source: `GET /api/v1/health`; client checked time is local session metadata, server time is display metadata.

## States

- Loading: shell visible, badge says checking, Settings disables Check Again while request is active.
- Ready: Home and Settings show ready status; no dialog.
- Not-ready: one-time dialog plus Settings details from workspace/scanner messages.
- Unreachable: one-time dialog plus retry affordance in Settings.
- Invalid-response: Settings says the wrapper answered in an unexpected format; retry remains available.
- Stale cache: ViewModel requests best-effort refresh on shell entry; future scan-dependent actions must not rely on stale ready state.

## Responsive Notes

- Mobile: single column, bottom nav floats above gesture area.
- Tablet: content can center in a max-width column; nav remains bottom-centered.
- Landscape: keep nav touch targets and allow vertical scrolling.

## Accessibility Notes

- Focus order: header, health summary, content cards, actions, bottom nav.
- Every icon-only or symbolic nav item needs a text label or accessibility label.
- Dialog focus starts on title, then actions; dismiss and Settings are both reachable.
- Status is never color-only; include text labels for Ready, Not ready, Unreachable, and Checking.
