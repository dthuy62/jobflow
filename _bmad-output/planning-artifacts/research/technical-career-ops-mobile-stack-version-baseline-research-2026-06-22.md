---
stepsCompleted: [1]
inputDocuments:
  - "_bmad-output/project-context.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "career-ops-wrapper/package.json"
  - "career-ops-wrapper/package-lock.json"
  - "gradle/libs.versions.toml"
  - "app/build.gradle.kts"
workflowType: 'research'
lastStep: 1
research_type: 'technical'
research_topic: 'Career Ops Mobile stack version baseline'
research_goals: 'Verify whether current Android and Node.js wrapper stack versions should use latest versions or conservative supported baselines, and update project-context guidance with source-backed recommendations.'
user_name: 'Hy'
date: '2026-06-22'
web_research_enabled: true
source_verification: true
---

# Research Report: technical

**Date:** 2026-06-22
**Author:** Hy
**Research Type:** technical

---

## Research Overview

## Technical Research Scope Confirmation

**Research Topic:** Career Ops Mobile stack version baseline

**Research Goals:** Verify whether current Android and Node.js wrapper stack versions should use latest versions or conservative supported baselines, then update project-context guidance with source-backed recommendations.

**User Preference:** Prefer latest versions by default. Use lower versions only when a real library/tooling conflict exists and cannot be resolved by configuration, dependency replacement, or reasonable implementation adjustment.

**Technical Research Scope:**

- Architecture Analysis - stack choices that affect the Android app and wrapper backend architecture.
- Implementation Approaches - version upgrade strategy, compatibility checks, and tooling practices.
- Technology Stack - Android SDK/AGP/Kotlin/Compose/Room/Retrofit/OkHttp/Moshi/Coroutines and Node/TypeScript/Fastify/Zod/Vitest/Scalar.
- Integration Patterns - wrapper API, OpenAPI docs, contract examples, and Android client compatibility.
- Performance Considerations - build stability, runtime support, test determinism, and local-first development ergonomics.

**Research Methodology:**

- Current web data with rigorous source verification.
- Prioritize official documentation, release notes, package metadata, and repository-maintained compatibility tables.
- Multi-source validation for version and compatibility claims.
- Clear distinction between latest available, current repository version, and recommended project action.

**Scope Confirmed:** 2026-06-22

---

<!-- Content will be appended sequentially through research workflow steps -->

## Technology Stack Analysis

### Executive Finding

Hy's preferred policy is **latest-first**. Based on current sources, that should mean:

1. Prefer the **latest stable release** for Android/Jetpack/Square libraries.
2. Prefer the **latest LTS runtime** for Node.js unless the project intentionally wants Current-channel Node.
3. Use a lower version only when a real compatibility conflict appears and cannot be resolved by a reasonable migration.
4. Record the conflict and reason whenever the project intentionally stays below latest.

This changes the project-context guidance: it should not present the current repository versions as ideal baselines. It should present them as **current repo state**, then instruct future agents to move toward latest stable when a story touches that stack area.

### Programming Languages

**Kotlin / Android**

- Current repo: Kotlin `2.2.10`.
- Latest stable from JetBrains release docs: Kotlin `2.4.0`, released June 3, 2026. JetBrains documents Kotlin's release cadence and lists `2.4.0` as the latest release line, with future `2.4.20` planned for September 2026. Source: [Kotlin release process](https://kotlinlang.org/docs/releases.html).
- Kotlin 2.3 introduced AGP 9-related migration notes: AGP 9 includes built-in Kotlin support, and Kotlin warns about using the old `kotlin-android` plugin with AGP 9. This project currently uses AGP 9.x and `org.jetbrains.kotlin.plugin.compose`, not the old `kotlin-android` plugin, but Kotlin/AGP/Compose plugin upgrades should be tested as a bundle. Source: [What's new in Kotlin 2.3.0](https://kotlinlang.org/docs/whatsnew23.html).
- Recommendation: **upgrade Kotlin toward latest stable** when touching Android build setup, but do it with AGP/Compose/KSP validation rather than isolated version bumps.

**TypeScript / Node.js**

- Current repo: TypeScript `^6.0.3`; npm reports latest TypeScript `6.0.3`.
- TypeScript 6 is current and acceptable. Source: [typescript npm](https://www.npmjs.com/package/typescript).
- Current repo has no `engines.node` in `career-ops-wrapper/package.json`.
- Node.js official release table currently lists Node `26` as Current and Node `24` as LTS; Node `22` is also LTS, while Node `20` is EOL. Source: [Node.js releases](https://nodejs.org/en/about/previous-releases).
- Fastify v5 requires Node `20+`, and explicitly explains the v20+ support floor. Source: [Fastify v5 migration guide](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/).
- Current `@scalar/fastify-api-reference@1.60.0` declares `engines.node >=22`; current `vitest@4.1.9` declares `^20.0.0 || ^22.0.0 || >=24.0.0` from package metadata.
- Recommendation: choose **Node 24 LTS** as the primary wrapper runtime for a latest-stable policy. Use Node 26 Current only if Hy explicitly wants Current-channel runtime. Add `engines.node` once the choice is made.

### Development Frameworks and Libraries

**Android build stack**

- Current repo: AGP `9.1.1`, Gradle wrapper `9.3.1`, compileSdk `36.1`, targetSdk `36`, minSdk `24`.
- Latest stable AGP found in Google Maven metadata: `9.2.1`; preview builds go up to `9.4.0-alpha01`, but those should not be default for a portfolio MVP.
- Official AGP 9.2 release notes state AGP 9.2 supports maximum API level `37.0`, requires Gradle `9.4.1`, SDK Build Tools `36.0.0`, and JDK `17`. Source: [AGP 9.2 release notes](https://developer.android.com/build/releases/agp-9-2-0-release-notes).
- Gradle current stable is `9.6.0`, released/final/current per Gradle's version service on 2026-06-22.
- Recommendation: latest-first target should be **AGP 9.2.1 + Gradle Wrapper 9.6.0 + compileSdk/API 37 if installed**, not AGP 9.1.1 / Gradle 9.3.1, unless a plugin/build conflict appears. Fall back to AGP's documented Gradle `9.4.1` only if Gradle 9.6.0 exposes a real unresolved build/tooling conflict.

**Jetpack Compose**

- Current repo: Compose BOM `2024.09.00`.
- Official Compose BOM mapping lists `2026.06.00` in the selectable BOM versions and was updated June 18, 2026. Source: [Compose BOM mapping](https://developer.android.com/develop/ui/compose/bom/bom-mapping).
- Android Developers Blog announced the April 2026 Compose stable release with core modules `1.11` and BOM `2026.04.01`; Google Maven metadata shows `2026.06.00` is available.
- Recommendation: upgrade Compose by BOM only, toward **latest available stable BOM**. Do not add per-artifact Compose versions.

**Room**

- Current repo: Room `2.7.0`.
- AndroidX Room release notes show stable `2.8.x` releases; `2.8.3` was released October 22, 2025 and includes a performance fix. Google Maven metadata currently reports latest/release `2.8.4`. Source: [Room release notes](https://developer.android.com/jetpack/androidx/releases/room).
- Room `3.0.0-alpha01` exists under a new `androidx.room3` package, but it is alpha and KMP-focused, so it is not the latest stable replacement for this Android MVP.
- Recommendation: latest-first stable target is **Room 2.8.4**, not Room 3 alpha.

**Networking / JSON**

- Current repo: Retrofit `2.12.0`, OkHttp `4.10.0`, Moshi `1.15.2`.
- Retrofit latest release is `3.0.0`; release notes say it upgrades to OkHttp 4.12 and now has a transitive Kotlin dependency. Source: [Retrofit releases](https://github.com/square/retrofit/releases).
- OkHttp latest release is `5.4.0` as of June 8, 2026. Source: [OkHttp changelog](https://square.github.io/okhttp/changelogs/changelog/).
- Moshi latest from Maven metadata is still `1.15.2`, so the repo is already current for Moshi.
- Recommendation: prefer **Retrofit 3.0.0** and **OkHttp 5.4.0** when networking is touched, but test Retrofit converter compatibility, logging-interceptor version alignment, and Android minSdk behavior.

**Coroutines / test UI**

- Current repo: Coroutines `1.10.2`, Roborazzi `1.59.0`.
- Maven metadata reports kotlinx-coroutines-android latest `1.11.0` and Roborazzi latest `1.64.0`.
- Recommendation: latest-first target should upgrade these when Android tests or async flows are touched, with test validation.

**Backend wrapper**

- Current repo already matches latest package metadata for core backend libs:
  - `fastify`: `5.8.5`
  - `zod`: `4.4.3`
  - `vitest`: `4.1.9`
  - `typescript`: `6.0.3`
  - `@scalar/fastify-api-reference`: `1.60.0`
- Zod 4 supports first-party JSON Schema conversion via `z.toJSONSchema()`, so the current OpenAPI strategy should not add `zod-to-json-schema` by default. Source: [Zod 4 release notes](https://zod.dev/v4).
- Vitest docs recommend installing Vitest into `package.json`; current project does that. Source: [Vitest guide](https://vitest.dev/guide/).
- Recommendation: backend is already latest-first except for missing `engines.node` and questionable `@types/node@26` alignment if the runtime baseline becomes Node 24 LTS.

### Database and Storage Technologies

- Android Room remains a projection cache only. Latest-first does not change the architecture rule that Career Ops Workspace is the source of truth.
- The wrapper backend still should not add a backend database for MVP.
- If Room upgrades to 2.8.x, keep projection entities and migrations small; do not adopt Room 3 alpha unless a dedicated KMP/storage story promotes it.

### Development Tools and Platforms

- Android versions should be managed through `gradle/libs.versions.toml`, but active usage must be confirmed in `app/build.gradle.kts`; many catalog entries are commented out and should not be treated as active dependencies.
- Backend versions should be managed through `package.json` and `package-lock.json`; prefer `npm ci` for reproducibility.
- Latest-first policy should use stable channels by default:
  - Stable Android/Jetpack releases yes.
  - Alpha/preview releases no, unless explicitly requested.
  - Node Current no by default if an LTS line satisfies dependencies.

### Cloud Infrastructure and Deployment

- No cloud backend is in MVP. The wrapper is local-first/personal LAN.
- Latest-first runtime policy affects local development and potential future packaging only; it does not imply Firebase/App Check/cloud hosting.

### Technology Adoption Trends

- Android ecosystem has moved materially since this repo's initial versions:
  - AGP stable advanced from 9.1.1 to 9.2.1.
  - Kotlin stable advanced from 2.2.10 to 2.4.0.
  - Compose BOM advanced from 2024.09.00 to 2026.06.00.
  - Room stable advanced from 2.7.0 to 2.8.4.
  - Retrofit advanced from 2.x to 3.0.0.
  - OkHttp advanced from 4.x to 5.x.
- Backend wrapper stack is already close to latest; the main action is runtime policy, not dependency bumping.

### Compatibility Matrix

| Area | Current repo | Latest stable/current found | Recommendation |
| --- | --- | --- | --- |
| AGP | 9.1.1 | 9.2.1 stable; 9.4 alpha preview | Upgrade to 9.2.1 before Android feature work if build remains green. |
| Gradle | 9.3.1 | 9.6.0 current stable; AGP 9.2 documents 9.4.1 as required/default | Prefer Gradle Wrapper 9.6.0; fall back to 9.4.1 only for proven AGP/tooling conflict. |
| JDK | local JDK 21 | AGP 9.2 minimum/default JDK 17 | JDK 21 is acceptable locally if AGP build passes; CI should declare JDK >=17. |
| compileSdk | 36.1 | AGP 9.2 supports max API 37.0 | Prefer compileSdk/API 37 if SDK installed. |
| Kotlin | 2.2.10 | 2.4.0 stable | Upgrade with AGP/Compose/KSP validation. |
| Compose BOM | 2024.09.00 | 2026.06.00 | Upgrade by BOM only. |
| Room | 2.7.0 | 2.8.4 stable; 3.0 alpha | Upgrade to 2.8.4; avoid 3 alpha for MVP. |
| Retrofit | 2.12.0 | 3.0.0 | Upgrade when API client story touches networking. |
| OkHttp | 4.10.0 | 5.4.0 | Upgrade with Retrofit/logging-interceptor alignment. |
| Moshi | 1.15.2 | 1.15.2 | Already current. |
| Coroutines | 1.10.2 | 1.11.0 | Upgrade with tests. |
| Roborazzi | 1.59.0 | 1.64.0 | Upgrade with screenshot baseline policy. |
| Node | unspecified | 26 Current, 24 LTS | Prefer Node 24 LTS unless Current is explicitly desired. |
| Fastify | ^5.8.5 | 5.8.5 | Already latest. |
| Zod | ^4.4.3 | 4.4.3 | Already latest. |
| TypeScript | ^6.0.3 | 6.0.3 | Already latest. |
| Vitest | ^4.1.9 | 4.1.9 | Already latest. |
| Scalar Fastify | ^1.60.0 | 1.60.0 | Already latest; requires Node >=22. |

### Project-Context Update Recommendation

Replace the saved Technology Stack section with a latest-first version:

- Mark current repo versions as **current state**, not preferred long-term baseline.
- State the policy: **latest stable first; downgrade only for proven unresolved conflicts**.
- For Android, instruct agents to upgrade stack intentionally when touching Android setup:
  - AGP 9.2.1
  - Gradle Wrapper 9.6.0
  - Kotlin 2.4.0
  - Compose BOM 2026.06.00
  - Room 2.8.4
  - Retrofit 3.0.0
  - OkHttp 5.4.0
  - Coroutines 1.11.0
  - Roborazzi 1.64.0
- For backend, keep current dependency versions, add Node runtime policy, and consider aligning `@types/node` with the chosen Node runtime.
