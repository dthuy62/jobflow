# Design Guidelines

## Product Feel

JobFlow should feel like a focused personal operations tool with a playful
neo-brutalist edge. Keep surfaces functional, direct, and readable. Avoid
generic enterprise dashboards unless the workflow truly needs dense tabular
management.

## Android Visual Language

Use existing components and tokens first:

- `ui/components/SoftComponents.kt` and `ui/health/HealthCards.kt`
- `ui/theme/Color.kt`
- `ui/theme/Theme.kt`
- `ui/theme/Type.kt`

Existing UI patterns include:

- Heavy black borders.
- Offset shadows.
- Bright accent colors.
- Bold labels.
- Explicit pressed states.

Do not replace feature screens with default Material cards/buttons when an
existing neo-brutalist component fits.

## Compose Structure

- Keep screen-level state in ViewModels.
- Keep UI functions stateless where practical.
- Split reusable pieces into focused components only when they are reused or
  materially reduce complexity.
- Use previews for non-trivial components when useful.
- Avoid putting network DTOs, Room entities or exceptions in UI state.

## UX States

Every wrapper-backed screen should consider:

- Loading.
- Ready.
- Not ready / setup required.
- Validation error.
- Unauthorized pairing token.
- Workspace unhealthy.
- Last-known local data when available.

## Accessibility

- Keep text contrast high.
- Do not rely on color alone for state.
- Use touch targets large enough for mobile.
- Preserve readable font sizes.
- Provide meaningful labels for icon-only actions.

## Copy

- Prefer short action-oriented labels.
- Surface setup failures in user language, not backend jargon.
- Do not show local absolute paths, tokens, CV text, or provider keys in UI
  errors.
