---
project_name: "task-arena"
user_name: "Hy"
date: "2026-06-22"
sections_completed: ["technology_stack"]
existing_patterns_found: 17
source_documents:
  - "_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/prd.md"
  - "_bmad-output/planning-artifacts/prds/prd-task-arena-2026-06-14/addendum.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/epics.md"
  - "_bmad-output/implementation-artifacts/sprint-status.yaml"
  - "_bmad-output/implementation-artifacts/1-1-scaffold-wrapper-backend-api-foundation.md"
  - "_bmad-output/implementation-artifacts/1-2-validate-wrapper-runtime-configuration-and-workspace-boundary.md"
  - "_bmad-output/implementation-artifacts/1-3-expose-health-and-workspace-readiness-api.md"
  - "_bmad-output/implementation-artifacts/1-7-expose-openapi-and-api-docs-for-wrapper-backend.md"
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- Product architecture: existing Android Kotlin/Jetpack Compose app plus local Node.js/TypeScript Wrapper Backend.
- Android versions are sourced from `gradle/libs.versions.toml` and active usage is confirmed in `app/build.gradle.kts`; do not treat catalog entries or commented dependencies as active dependencies.
- Android current repo state: Kotlin 2.2.10, Android Gradle Plugin 9.1.1, Compose BOM 2024.09.00, compileSdk 36.1, minSdk 24, targetSdk 36, Gradle Wrapper 9.3.1.
- Android target policy is latest stable first. Preferred upgrade baseline is Gradle Wrapper 9.6.0, Android Gradle Plugin 9.2.1, Kotlin/Compose plugin 2.4.0, Compose BOM 2026.06.00, compileSdk 37, targetSdk 37, minSdk 24. Fall back to AGP's documented Gradle 9.4.1 only if Gradle 9.6.0 exposes a real unresolved AGP/tooling conflict.
- Android build tooling currently runs with JDK 21 locally; app bytecode compatibility remains Java 11 until an Android build story intentionally revises it. Do not confuse build JDK with app source/target compatibility.
- Android active libraries currently include Room 2.7.0, Retrofit 2.12.0, OkHttp 4.10.0, Moshi 1.15.2, Coroutines 1.10.2, Robolectric 4.16.1, and Roborazzi 1.59.0. Preferred latest-stable targets are Room 2.8.4, Retrofit 3.0.0, OkHttp 5.4.0, Moshi 1.15.2, Coroutines 1.11.0, Robolectric 4.16.1, and Roborazzi 1.64.0.
- Compose artifacts must be governed by the Compose BOM; do not add individual Compose artifact versions unless a story explicitly requires it.
- Room and Moshi use KSP/codegen. Any Room, Moshi, Kotlin, or KSP upgrade must be validated together with annotation processing and generated sources.
- Android dev/prod product flavors are an architecture requirement for Career Ops Mobile, but the existing Android app does not yet implement those flavors. Until `productFlavors` exists, do not create flavor-specific source sets, BuildConfig keys, resources, tests, or CI commands.
- Backend wrapper is a Node.js/TypeScript ESM project in `career-ops-wrapper`.
- Backend runtime dependencies are declared in `career-ops-wrapper/package.json` and resolved by `package-lock.json`: Fastify ^5.8.5, Zod ^4.4.3, js-yaml ^4.2.0, dotenv ^17.4.2, and @scalar/fastify-api-reference ^1.60.0.
- Backend dev tooling: TypeScript ^6.0.3, tsx ^4.22.4, Vitest ^4.1.9, and @types/node ^26.0.0.
- Backend TypeScript is strict and uses ESM/NodeNext: `target: ES2023`, `module: NodeNext`, `moduleResolution: NodeNext`, `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`. Do not introduce CommonJS `require` patterns or weaken TypeScript config to make code compile.
- Backend stories should currently assume Node >=22 because Scalar Fastify API Reference declares Node >=22. Do not claim Node 18/20 compatibility unless the incompatible dependency is removed/downgraded or the runtime matrix is explicitly revised.
- `@types/node` should align with the supported runtime major before depending on newer Node APIs; current `@types/node@26` may type APIs that are not available on Node 22.
- Zod 4 is the contract/schema source. Use Zod 4 first-party JSON Schema conversion for OpenAPI unless a story proves a different generator is needed; do not add `zod-to-json-schema` or deprecated Swagger packages by default.
- Scalar is docs UI only, not the API contract source of truth. If Scalar creates runtime compatibility pressure, replacing the docs UI is lower-risk than changing the wrapper architecture.
- Career Ops integration target is a real Career Ops Workspace initialized by `npx @santifer/career-ops init`; the wrapper may run inside that workspace or receive `--workspace /path/to/career-ops`.
- MVP scan path is the local Career Ops script runner (`node scan.mjs` or equivalent `npm run scan`) only; Gemini/OpenAI/Anthropic API keys and native AI CLI slash-command workflows are not MVP dependencies.
- Do not replace the existing Android app or introduce a new mobile starter. Do not replace the backend with NestJS, Prisma, a database-first template, tRPC, or a direct Android port unless architecture is intentionally revised.
- If planning docs and actual source files conflict, implementation agents must inspect current source files first: `career-ops-wrapper/package.json`, `career-ops-wrapper/package-lock.json`, `gradle/libs.versions.toml`, `app/build.gradle.kts`, and Gradle wrapper config.

## Critical Implementation Rules

_Documented after discovery phase._
