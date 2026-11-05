# Design Guidelines

The full design, with flows, states and exact values, is in
[the JobFlow UX design](superpowers/specs/2026-10-30-jobflow-ux-design.md).

## Product Feel

JobFlow should feel like an AI product: vivid colour, big confident type, real
glass, and motion that means something. It asks for almost nothing: one sentence
instead of a form, no waiting and no long flows. Avoid generic dashboards.

## Android Visual Language

The visual system is **Vivid**. Material 3 supplies the rules, and colour and glass
make it distinctive. Neo-brutalist is retired; do not use it for new screens.

Use existing tokens first, and add missing ones there:

- `ui/theme/Color.kt`
- `ui/theme/Spacing.kt`
- `ui/theme/Theme.kt`
- `ui/theme/Type.kt`

Rules:

- Background: the fixed yellow to pink to violet gradient, with long reading on white.
- Text on the gradient is ink, or sits on a translucent white panel.
- Font: Be Vietnam Pro, weights 400 to 700, on the Material 3 type scale.
- Spacing: 4, 8, 12, 16, 20, 24, 32 only. Screen margin 16, between sections 24.
- Shape: large cards 28, rows 20, logo tiles 12, chips and buttons full.
- Icons: Material Symbols Rounded, outlined, filled when selected.
- Primary action: a black pill.
- The orb means AI is at work or about to be. It is never decoration.
- Real glass (`kyant/backdrop`) is only for the navigation bar and the Get Started
  composer. Cards use plain translucency so scrolling stays smooth.

## Compose Structure

- Keep screen-level state in ViewModels.
- Keep UI functions stateless where practical.
- Split reusable pieces into focused components only when they are reused or
  materially reduce complexity.
- Use previews for non-trivial components when useful.
- Avoid putting network DTOs, Room entities or exceptions in UI state.

## UX States

Every screen backed by the API should consider:

- Loading, with skeletons rather than a blocking spinner.
- Ready.
- Empty, which looks intentional and says what to do next.
- Validation error.
- Guest, signed out, or sign-in required.
- Service unavailable, which keeps the user signed in.
- Last-known local data when available.

A job with no AI score is normal and must look finished.

## Accessibility

- Keep text contrast high.
- Do not rely on color alone for state.
- Use touch targets large enough for mobile.
- Preserve readable font sizes, and let big headlines wrap.
- Provide meaningful labels for icon-only actions.
- Respect the system's reduced motion setting.

## Copy

- Prefer short action-oriented labels.
- Surface setup failures in user language, not backend jargon.
- All user-facing wording lives in Android string resources, because the app is
  multi-language and the server is English-only.
- Do not show local absolute paths, tokens, CV text, or provider keys in UI
  errors.
- Do not use "career-ops" in anything user-facing.
