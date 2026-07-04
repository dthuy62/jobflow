# JobFlow Soft Bottom Navigation Design

Date: 2026-07-04
Story: 1.5 - Build Career Ops App Shell and Health Feedback
Status: Approved for implementation planning

## Context

Story 1.5 is currently in review, but the product visual direction has changed.
JobFlow will keep the existing `NeoBrutalist.kt` component as legacy source, but
new Career Ops features should not use neo-brutalist primitives.

The new direction is a soft, playful mobile job app concept:

- light cool-gray background
- large rounded white cards
- soft shadows instead of hard borders
- friendly bold typography
- green, yellow, coral, and muted pastel accents
- thin line icons
- smooth, expressive motion

The bottom navigation should preserve the current app-shell destinations:
`Home`, `Add`, and `Settings`.

## Recommended Approach

Build a small custom Compose bottom navigation component inspired by the existing
Flutter implementation in:

`/Users/dthuy/Workspace/kollet/kollet-app/lib/features/home/widgets/bottom_navbar`

This keeps the best part of the Flutter UI: the elastic sliding indicator. It
avoids adding dependencies and avoids forcing Material `NavigationBar` into a
motion model it does not naturally support.

Rejected approaches:

- Material3 `NavigationBar` with custom colors: less code, but weaker motion.
- Full app-shell redesign in this story: visually cleaner, but too broad for
  the current review patch cycle.

## Architecture

Add one reusable presentation component:

```kotlin
@Composable
fun JobFlowBottomNavigation(
    selectedDestination: JobFlowDestination,
    onSelectDestination: (JobFlowDestination) -> Unit,
    modifier: Modifier = Modifier
)
```

`CareerOpsShellContent` calls this from `Scaffold.bottomBar`.

State remains in `JobFlowShellUiState.selectedDestination`. The nav component is
stateless from the screen's point of view; it only owns transient animation
values. It must not know about ViewModels, repositories, DTOs, backend health,
or Android Navigation routes.

## Component Contract

Use these internal pieces if they keep the file readable:

- `JobFlowBottomNavigation`: outer safe-area wrapper and floating pill surface.
- `JobFlowBottomNavItem`: equal-size item for Home, Add, and Settings.
- `ElasticNavIndicator`: animated rounded rect whose left and right edges move
  with different easing curves.

All three destinations are visually equal. The center `Add` item must not have
special shutter, morph, or camera behavior; that was specific to the Flutter app.

## Visual Design

Bottom nav style:

- surface: white or near-white pill
- shape: full pill
- elevation: soft shadow, no hard border
- active indicator: pale mint or soft yellow
- active icon: dark charcoal or primary
- inactive icon: muted gray
- visible labels: none
- accessibility labels: required for every icon
- minimum touch target: at least 48 dp

Use existing Compose and Material 3 primitives. Do not add a dependency.

## Motion

On destination change:

- animate indicator left edge and right edge independently
- when moving right, the right edge should lead and the left edge should follow
- when moving left, the left edge should lead and the right edge should follow
- animate selected icon tint
- scale selected icon to about `1.05`
- keep unselected icon at `1.0`

When tapping the already-selected destination:

- do not dispatch the selection intent again
- do not restart animation

## Data Flow

The flow remains:

```text
JobFlowShellUiState.selectedDestination
-> JobFlowBottomNavigation
-> onSelectDestination
-> JobFlowShellIntent.SelectDestination
-> JobFlowShellViewModel
```

No backend or domain behavior changes are required for the bottom nav itself.

## Story 1.5 Updates

Before implementation, update the story artifacts:

- move Story 1.5 from `review` back to `in-progress`
- revise AC12 to remove neo-brutalist and liquid-glass wording
- describe the new soft playful M3E-inspired direction
- mention the Flutter bottom nav as motion reference
- keep existing review findings; they still need resolution before review
- keep `NeoBrutalist.kt` in the repository but stop using it in Career Ops shell

## Testing

For the bottom-nav-only UI change, the cheapest relevant check is:

```bash
cd android
./gradlew assembleDevDebug
```

If the implementation also patches Story 1.5 ViewModel/repository review
findings, also run:

```bash
cd android
./gradlew testDevDebugUnitTest
```

## Open Decisions

None. The destination set, component scope, visual style, motion behavior, and
testing path are decided.
