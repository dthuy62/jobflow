# JobFlow Soft Bottom Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Story 1.5 bottom navigation with a reusable soft Compose pill nav inspired by the existing Flutter animation, while updating story artifacts to the new visual direction.

**Architecture:** Add one reusable Compose component under `presentation/component/` and call it from the existing Career Ops shell `Scaffold.bottomBar`. Keep navigation state in `JobFlowShellUiState.selectedDestination`; the nav component owns only transient animation values. Remove `NeoBrutalist.kt` usage from the Career Ops shell without deleting the legacy component.

**Tech Stack:** Kotlin 2.4.0, Jetpack Compose BOM 2026.06.00, Material 3, AndroidX Compose animation primitives, existing `material-icons-core`.

## Global Constraints

- Story 1.5 destinations remain exactly `Home`, `Add`, and `Settings`.
- Do not add a dependency.
- Do not introduce Android Navigation routes for this task.
- Keep `NeoBrutalist.kt` in the repository, but do not import it from Career Ops shell code.
- Android UI must not import Retrofit services, Room DAOs, API DTOs, or database entities.
- Preserve the Android-wrapper boundary; Android still calls the wrapper API only through existing domain/use-case flow.
- No URL/token input affordances in Settings.
- Bottom nav touch targets must be at least 48 dp.
- Every icon-only destination must have a content description.
- Use `devDebug` checks.
- Respect dirty worktrees; stage only files touched by this plan.

---

## File Structure

- Modify: `_bmad-output/implementation-artifacts/1-5-build-career-ops-app-shell-and-health-feedback.md`
  - Move Story 1.5 back to `in-progress`.
  - Replace the old neo-brutalist/liquid-glass AC12 language with the new soft playful direction.
  - Add the bottom-nav redesign to task notes and change log.

- Modify: `_bmad-output/design-artifacts/story-1-5-wireframe-spec.md`
  - Replace the old style direction with the approved soft playful M3E-inspired direction.
  - Keep the same Home/Add/Settings wireframe and accessibility requirements.

- Create: `android/app/src/main/java/me/dthuy/jobflow/presentation/component/JobFlowBottomNavigation.kt`
  - Own the soft pill nav, equal items, icon animation, and elastic indicator.
  - Consume `JobFlowDestination` and emit `onSelectDestination`.

- Modify: `android/app/src/main/java/me/dthuy/jobflow/presentation/screen/jobflow/JobFlowShellScreen.kt`
  - Use `JobFlowBottomNavigation` in `Scaffold.bottomBar`.
  - Replace Career Ops shell uses of `NeoCard`, `NeoButton`, and `NeoBadge` with local soft UI functions.
  - Keep shell behavior and health flow unchanged.

---

### Task 1: Update Story 1.5 Artifacts

**Files:**
- Modify: `_bmad-output/implementation-artifacts/1-5-build-career-ops-app-shell-and-health-feedback.md`
- Modify: `_bmad-output/design-artifacts/story-1-5-wireframe-spec.md`

**Interfaces:**
- Consumes: Approved design spec at `docs/superpowers/specs/2026-07-04-jobflow-soft-bottom-navigation-design.md`.
- Produces: Story artifacts that allow implementation to continue in Story 1.5.

- [ ] **Step 1: Update story status and AC12**

In `_bmad-output/implementation-artifacts/1-5-build-career-ops-app-shell-and-health-feedback.md`, replace:

```markdown
Status: review
```

with:

```markdown
Status: in-progress
```

Replace AC12 with:

```markdown
12. Given visual design is reviewed, when Home, Add, Settings, health dialog, and floating bottom navigation are inspected, then the UI follows the approved soft playful mobile job-app direction with light cool-gray background, large rounded white surfaces, soft shadows, friendly bold typography, thin line icons, green/yellow/coral pastel accents, readable contrast, no neo-brutalist primitives in Career Ops feature code, and no URL/token input affordances.
```

- [ ] **Step 2: Update Compose shell UI task wording**

In the same story file, replace the current Compose shell UI task block:

```markdown
- [x] Add Compose shell UI. (AC: 1-4, 8-12)
  - [x] Build Home, Add, Settings, one-time health dialog, and floating bottom nav using existing neo-brutalist components/theme where practical.
  - [x] Keep Add as a reserved future-input area only.
  - [x] Keep Settings free of editable URL/token fields.
  - [x] Apply Swiss Industrial Print structure plus restrained translucent nav surface without decorative blur/orbs.
```

with:

```markdown
- [ ] Refresh Compose shell UI direction. (AC: 1-4, 8-12)
  - [ ] Keep Home, Add, Settings, one-time health dialog, and floating bottom nav behavior.
  - [ ] Replace Career Ops shell usage of neo-brutalist primitives with soft rounded Material 3 Compose surfaces.
  - [ ] Add a reusable Flutter-inspired soft bottom nav with elastic indicator motion.
  - [ ] Keep Add as a reserved future-input area only.
  - [ ] Keep Settings free of editable URL/token fields.
```

- [ ] **Step 3: Update design target notes**

In the story file, replace the `### Design Target` section body with:

```markdown
Use `_bmad-output/design-artifacts/story-1-5-wireframe-spec.md` as the shell structure target and `docs/superpowers/specs/2026-07-04-jobflow-soft-bottom-navigation-design.md` as the bottom navigation design target.

The approved direction is soft playful mobile job-app UI: light cool-gray background, large rounded white cards, soft shadows, friendly bold typography, thin line icons, green/yellow/coral pastel accents, and smooth expressive motion.

Use the Flutter bottom navigation source at `/Users/dthuy/Workspace/kollet/kollet-app/lib/features/home/widgets/bottom_navbar` as motion reference only. Preserve JobFlow destinations as Home, Add, and Settings. Do not use `NeoBrutalist.kt` primitives in Career Ops feature code.
```

- [ ] **Step 4: Add change log entry**

Append this line under `## Change Log`:

```markdown
- 2026-07-04: Reopened Story 1.5 implementation for the approved soft playful UI direction and Flutter-inspired Compose bottom navigation.
```

- [ ] **Step 5: Update wireframe style direction**

In `_bmad-output/design-artifacts/story-1-5-wireframe-spec.md`, replace:

```markdown
- Style direction: existing neo-brutalist components plus Swiss Industrial Print structure and a restrained translucent floating nav surface. No URL/token inputs.
```

with:

```markdown
- Style direction: soft playful mobile job-app UI with light cool-gray background, large rounded white surfaces, soft shadows, friendly bold typography, thin line icons, green/yellow/coral pastel accents, and a Flutter-inspired elastic floating bottom nav. No URL/token inputs.
```

- [ ] **Step 6: Verify artifact edits**

Run:

```bash
rg -n "Status:|neo-brutalist|liquid-glass|Design Target|2026-07-04" _bmad-output/implementation-artifacts/1-5-build-career-ops-app-shell-and-health-feedback.md _bmad-output/design-artifacts/story-1-5-wireframe-spec.md
```

Expected:

```text
_bmad-output/implementation-artifacts/1-5-build-career-ops-app-shell-and-health-feedback.md:10:Status: in-progress
```

The only remaining `neo-brutalist` matches should say not to use those primitives in Career Ops feature code.

- [ ] **Step 7: Commit story artifact updates**

Run:

```bash
git add _bmad-output/implementation-artifacts/1-5-build-career-ops-app-shell-and-health-feedback.md _bmad-output/design-artifacts/story-1-5-wireframe-spec.md
git commit -m "docs: reopen story 1.5 for soft nav direction"
```

---

### Task 2: Add Reusable Soft Bottom Navigation

**Files:**
- Create: `android/app/src/main/java/me/dthuy/jobflow/presentation/component/JobFlowBottomNavigation.kt`

**Interfaces:**
- Consumes: `JobFlowDestination` enum from `me.dthuy.jobflow.presentation.screen.jobflow`.
- Produces:
  - `@Composable fun JobFlowBottomNavigation(selectedDestination: JobFlowDestination, onSelectDestination: (JobFlowDestination) -> Unit, modifier: Modifier = Modifier)`

- [ ] **Step 1: Create the component file**

Create `android/app/src/main/java/me/dthuy/jobflow/presentation/component/JobFlowBottomNavigation.kt` with:

```kotlin
package me.dthuy.jobflow.presentation.component

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import me.dthuy.jobflow.presentation.screen.jobflow.JobFlowDestination
import kotlin.math.roundToInt

private val SoftNavSurface = Color(0xFFFEFEFF)
private val SoftNavIndicator = Color(0xFFDFF5F2)
private val SoftNavIconActive = Color(0xFF24262D)
private val SoftNavIconInactive = Color(0xFF9CA3AF)

@Composable
fun JobFlowBottomNavigation(
    selectedDestination: JobFlowDestination,
    onSelectDestination: (JobFlowDestination) -> Unit,
    modifier: Modifier = Modifier
) {
    val destinations = remember { JobFlowDestination.entries.toList() }
    val selectedIndex = destinations.indexOf(selectedDestination).coerceAtLeast(0)
    val itemWidth = 64.dp
    val itemSpacing = 16.dp
    val itemHeight = 48.dp
    val totalWidth = itemWidth * destinations.size + itemSpacing * (destinations.size - 1)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(start = 24.dp, end = 24.dp, bottom = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .shadow(elevation = 18.dp, shape = CircleShape, spotColor = Color(0x26000000))
                .background(SoftNavSurface, CircleShape)
                .padding(6.dp)
                .width(totalWidth)
                .height(itemHeight),
        ) {
            ElasticNavIndicator(
                selectedIndex = selectedIndex,
                itemWidth = itemWidth,
                itemSpacing = itemSpacing,
                modifier = Modifier
                    .width(itemWidth)
                    .height(itemHeight)
            )

            Row(
                horizontalArrangement = Arrangement.spacedBy(itemSpacing),
                verticalAlignment = Alignment.CenterVertically
            ) {
                destinations.forEach { destination ->
                    JobFlowBottomNavItem(
                        destination = destination,
                        selected = destination == selectedDestination,
                        onClick = {
                            if (destination != selectedDestination) {
                                onSelectDestination(destination)
                            }
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun ElasticNavIndicator(
    selectedIndex: Int,
    itemWidth: androidx.compose.ui.unit.Dp,
    itemSpacing: androidx.compose.ui.unit.Dp,
    modifier: Modifier = Modifier
) {
    val density = LocalDensity.current
    val itemWidthPx = with(density) { itemWidth.toPx() }
    val itemStepPx = with(density) { (itemWidth + itemSpacing).toPx() }
    val targetLeft = selectedIndex * itemStepPx
    val targetRight = targetLeft + itemWidthPx
    val left = remember { Animatable(targetLeft) }
    val right = remember { Animatable(targetRight) }
    var previousIndex by remember { mutableStateOf(selectedIndex) }

    LaunchedEffect(selectedIndex, itemWidthPx, itemStepPx) {
        val movingRight = selectedIndex > previousIndex
        previousIndex = selectedIndex
        val leadEasing = CubicBezierEasing(0.22f, 1f, 0.36f, 1f)
        val followEasing = FastOutSlowInEasing

        coroutineScope {
            launch {
                left.animateTo(
                    targetValue = targetLeft,
                    animationSpec = tween(
                        durationMillis = 350,
                        easing = if (movingRight) followEasing else leadEasing
                    )
                )
            }
            launch {
                right.animateTo(
                    targetValue = targetRight,
                    animationSpec = tween(
                        durationMillis = 350,
                        easing = if (movingRight) leadEasing else followEasing
                    )
                )
            }
        }
    }

    Box(
        modifier = modifier
            .offset { IntOffset(left.value.roundToInt(), 0) }
            .width(with(density) { (right.value - left.value).toDp() })
            .background(SoftNavIndicator, CircleShape)
    )
}

@Composable
private fun JobFlowBottomNavItem(
    destination: JobFlowDestination,
    selected: Boolean,
    onClick: () -> Unit
) {
    val tint by animateColorAsState(
        targetValue = if (selected) SoftNavIconActive else SoftNavIconInactive,
        animationSpec = tween(durationMillis = 260),
        label = "bottomNavIconTint"
    )
    val scale = if (selected) 1.05f else 1f

    Box(
        modifier = Modifier
            .size(width = 64.dp, height = 48.dp)
            .clickable(
                role = Role.Tab,
                onClick = onClick
            ),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = destination.icon(),
            contentDescription = destination.contentDescription(),
            tint = tint,
            modifier = Modifier.size((24 * scale).dp)
        )
    }
}

private fun JobFlowDestination.icon(): ImageVector =
    when (this) {
        JobFlowDestination.HOME -> Icons.Default.Home
        JobFlowDestination.ADD -> Icons.Default.Add
        JobFlowDestination.SETTINGS -> Icons.Default.Settings
    }

private fun JobFlowDestination.contentDescription(): String =
    when (this) {
        JobFlowDestination.HOME -> "Home"
        JobFlowDestination.ADD -> "Add"
        JobFlowDestination.SETTINGS -> "Settings"
    }
```

- [ ] **Step 2: Compile just enough to catch import/API errors**

Run:

```bash
cd android
./gradlew assembleDevDebug
```

Expected: `BUILD SUCCESSFUL`. If it fails on `Modifier.size(width = 64.dp, height = 48.dp)`, replace it with:

```kotlin
Modifier
    .width(64.dp)
    .height(48.dp)
```

- [ ] **Step 3: Commit the component**

Run:

```bash
git add android/app/src/main/java/me/dthuy/jobflow/presentation/component/JobFlowBottomNavigation.kt
git commit -m "feat: add soft bottom navigation component"
```

---

### Task 3: Wire the Nav and Remove Neo Usage from Career Ops Shell

**Files:**
- Modify: `android/app/src/main/java/me/dthuy/jobflow/presentation/screen/jobflow/JobFlowShellScreen.kt`

**Interfaces:**
- Consumes:
  - `JobFlowBottomNavigation(selectedDestination: JobFlowDestination, onSelectDestination: (JobFlowDestination) -> Unit, modifier: Modifier = Modifier)`
  - existing `JobFlowShellUiState`
  - existing `JobFlowShellIntent`
- Produces:
  - Career Ops shell with no imports from `me.dthuy.jobflow.presentation.component.Neo*`
  - `Scaffold.bottomBar` using `JobFlowBottomNavigation`

- [ ] **Step 1: Replace imports**

In `JobFlowShellScreen.kt`, remove these imports:

```kotlin
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.ui.graphics.vector.ImageVector
import me.dthuy.jobflow.presentation.component.NeoBadge
import me.dthuy.jobflow.presentation.component.NeoButton
import me.dthuy.jobflow.presentation.component.NeoCard
import me.dthuy.jobflow.ui.theme.NeoBlack
import me.dthuy.jobflow.ui.theme.NeoBlue
import me.dthuy.jobflow.ui.theme.NeoBg
import me.dthuy.jobflow.ui.theme.NeoGreen
import me.dthuy.jobflow.ui.theme.NeoOrange
import me.dthuy.jobflow.ui.theme.NeoRed
import me.dthuy.jobflow.ui.theme.NeoWhite
import me.dthuy.jobflow.ui.theme.NeoYellow
```

Add these imports:

```kotlin
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Surface
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.RowScope
import androidx.compose.ui.draw.shadow
import me.dthuy.jobflow.presentation.component.JobFlowBottomNavigation
```

- [ ] **Step 2: Wire the bottom bar**

Replace the current `Scaffold` start:

```kotlin
    Scaffold(
        modifier = modifier
            .fillMaxSize(),
        containerColor = NeoBg,
        bottomBar = {
            FloatingBottomNav(
                selectedDestination = state.selectedDestination,
                onSelect = { onIntent(JobFlowShellIntent.SelectDestination(it)) }
            )
        }
    ) { innerPadding ->
```

with:

```kotlin
    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = JobFlowBackground,
        bottomBar = {
            JobFlowBottomNavigation(
                selectedDestination = state.selectedDestination,
                onSelectDestination = { onIntent(JobFlowShellIntent.SelectDestination(it)) }
            )
        }
    ) { innerPadding ->
```

- [ ] **Step 3: Replace shell colors and button/card calls**

In `JobFlowShellScreen.kt`, make these replacements:

```text
NeoBlack -> JobFlowInk
NeoWhite -> JobFlowSurface
NeoYellow -> JobFlowYellow
NeoGreen -> JobFlowMint
NeoBlue -> JobFlowBlue
NeoOrange -> JobFlowCoral
NeoRed -> JobFlowRed
NeoCard -> SoftCard
NeoButton -> SoftButton
NeoBadge -> SoftBadge
```

Then replace `SoftButton` call sites so the named color parameter is `containerColor`, not `backgroundColor`:

```kotlin
SoftButton(onClick = onOpenAdd, containerColor = JobFlowMint) {
    Text("OPEN ADD", color = JobFlowInk, fontWeight = FontWeight.Black)
}
```

```kotlin
SoftButton(
    onClick = onCheckAgain,
    enabled = health.kind != HealthUiKind.LOADING,
    containerColor = JobFlowBlue
) {
    Text("CHECK AGAIN", color = JobFlowInk, fontWeight = FontWeight.Black)
}
```

```kotlin
SoftButton(onClick = onSettings, containerColor = JobFlowYellow) {
    Text("SETTINGS", color = JobFlowInk, fontWeight = FontWeight.Black)
}
```

```kotlin
SoftButton(onClick = onDismiss, containerColor = JobFlowSurface) {
    Text("DISMISS", color = JobFlowInk, fontWeight = FontWeight.Black)
}
```

- [ ] **Step 4: Delete old private bottom nav functions**

Remove the whole `FloatingBottomNav` function, starting at this signature and
ending at that function's matching closing brace:

```kotlin
@Composable
private fun FloatingBottomNav(
    selectedDestination: JobFlowDestination,
    onSelect: (JobFlowDestination) -> Unit
)
```

Remove the whole `NavButton` function, starting at this signature and ending at
that function's matching closing brace:

```kotlin
@Composable
private fun NavButton(
    destination: JobFlowDestination,
    selectedDestination: JobFlowDestination,
    icon: ImageVector,
    label: String,
    onSelect: (JobFlowDestination) -> Unit,
    modifier: Modifier = Modifier
)
```

- [ ] **Step 5: Add local soft UI helpers and colors**

Add this block above `private fun HealthUiKind.surfaceColor()`:

```kotlin
@Composable
private fun SoftCard(
    modifier: Modifier = Modifier,
    backgroundColor: Color = JobFlowSurface,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .shadow(elevation = 14.dp, shape = RoundedCornerShape(28.dp), spotColor = Color(0x18000000)),
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            content = content
        )
    }
}

@Composable
private fun SoftButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    containerColor: Color = JobFlowYellow,
    enabled: Boolean = true,
    content: @Composable RowScope.() -> Unit
) {
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        shape = CircleShape,
        colors = ButtonDefaults.buttonColors(
            containerColor = containerColor,
            contentColor = JobFlowInk,
            disabledContainerColor = JobFlowMuted.copy(alpha = 0.24f),
            disabledContentColor = JobFlowMuted
        ),
        content = content
    )
}

@Composable
private fun SoftBadge(
    text: String,
    backgroundColor: Color,
    modifier: Modifier = Modifier,
    textColor: Color = JobFlowInk
) {
    Surface(
        modifier = modifier,
        shape = CircleShape,
        color = backgroundColor
    ) {
        Text(
            text = text.uppercase(),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace
        )
    }
}

private val JobFlowBackground = Color(0xFFF4F5F9)
private val JobFlowSurface = Color(0xFFFEFEFF)
private val JobFlowInk = Color(0xFF24262D)
private val JobFlowMuted = Color(0xFF8F96A3)
private val JobFlowYellow = Color(0xFFFFD84D)
private val JobFlowMint = Color(0xFFDFF5F2)
private val JobFlowBlue = Color(0xFFDCEBFF)
private val JobFlowCoral = Color(0xFFFFC1A6)
private val JobFlowRed = Color(0xFFFF8B8B)
```

- [ ] **Step 6: Update health colors**

Replace `surfaceColor()` with:

```kotlin
private fun HealthUiKind.surfaceColor(): Color =
    when (this) {
        HealthUiKind.LOADING -> JobFlowBlue
        HealthUiKind.READY -> JobFlowMint
        HealthUiKind.NOT_READY -> JobFlowCoral
        HealthUiKind.UNREACHABLE,
        HealthUiKind.INVALID_RESPONSE -> JobFlowRed
    }
```

- [ ] **Step 7: Verify Neo imports are gone from Career Ops shell**

Run:

```bash
rg -n "Neo|FloatingBottomNav|NavButton" android/app/src/main/java/me/dthuy/jobflow/presentation/screen/jobflow/JobFlowShellScreen.kt
```

Expected: no output.

- [ ] **Step 8: Build the UI**

Run:

```bash
cd android
./gradlew assembleDevDebug
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 9: Commit shell wiring**

Run:

```bash
git add android/app/src/main/java/me/dthuy/jobflow/presentation/screen/jobflow/JobFlowShellScreen.kt
git commit -m "feat: wire soft bottom navigation into shell"
```

---

### Task 4: Final Story Validation

**Files:**
- Modify: `_bmad-output/implementation-artifacts/1-5-build-career-ops-app-shell-and-health-feedback.md`
- Modify: `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Interfaces:**
- Consumes: Successful `assembleDevDebug` from Task 3.
- Produces: Story record that reflects the bottom navigation refresh and current validation.

- [ ] **Step 1: Run Android unit tests**

Run:

```bash
cd android
./gradlew testDevDebugUnitTest
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 2: Run Android assemble**

Run:

```bash
cd android
./gradlew assembleDevDebug
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 3: Update story completion notes**

In `_bmad-output/implementation-artifacts/1-5-build-career-ops-app-shell-and-health-feedback.md`, append under `### Completion Notes`:

```markdown
- Replaced the Career Ops shell bottom navigation with a reusable soft Compose pill nav using Flutter-inspired elastic indicator motion.
- Removed neo-brutalist primitive usage from the Career Ops shell while keeping the legacy component available in the repository.
```

- [ ] **Step 4: Update debug log**

Append under `### Debug Log`:

```markdown
- 2026-07-04: Reopened Story 1.5 for the soft playful UI direction and bottom navigation refresh.
- 2026-07-04: `./gradlew testDevDebugUnitTest` passed after the bottom navigation refresh.
- 2026-07-04: `./gradlew assembleDevDebug` passed after the bottom navigation refresh.
```

- [ ] **Step 5: Keep story status honest**

If all review findings are still open, leave:

```markdown
Status: in-progress
```

If all review findings have been patched in a separate pass, set:

```markdown
Status: review
```

For this plan alone, expected status is:

```markdown
Status: in-progress
```

- [ ] **Step 6: Commit final validation notes**

Run:

```bash
git add _bmad-output/implementation-artifacts/1-5-build-career-ops-app-shell-and-health-feedback.md _bmad-output/implementation-artifacts/sprint-status.yaml
git commit -m "docs: update story 1.5 validation notes"
```

---

## Self-Review

Spec coverage:

- Story status and AC12 update: Task 1.
- Soft custom Compose pill nav: Task 2.
- Home/Add/Settings kept equal with no special center behavior: Task 2.
- Elastic indicator and icon tint/scale animation: Task 2.
- Career Ops shell stops importing Neo primitives: Task 3.
- Existing health state/data flow stays unchanged: Task 3.
- Validation commands: Task 3 and Task 4.

No new dependencies, navigation framework, backend behavior, URL/token inputs, or Career Ops workspace access are introduced.
