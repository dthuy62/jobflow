# Code Standards

## Repository Principles

- Keep changes scoped to the requested behavior.
- Prefer existing patterns and dependencies before adding new ones.
- Do not rewrite architecture for a single feature.
- Keep generated output out of source edits.
- Respect dirty worktrees; never revert user changes unless explicitly asked.
- Verify with the smallest command that can fail for the changed behavior.

## Android Standards

- Use Kotlin official formatting via ktlint. Run `cd android && ./gradlew ktlintFormat` before staging Kotlin changes.
- Run `cd android && ./gradlew qualityCheck` to enforce ktlint and detekt; the tracked pre-commit hook runs this task automatically after `./gradlew installGitHooks`.
- Preserve layer direction: `presentation -> domain -> data`.
- UI calls ViewModels/use cases, not Retrofit services, Room DAOs, DTOs, or
  entities.
- DTOs live in `data/models/`; domain concepts live in `domain/model/`.
- Repository implementations translate data-layer DTOs/entities to domain.
- Keep `AppContainer` as the dependency locator until the project explicitly
  adopts DI.
- Preserve MVI-style screen structure: immutable state, sealed intents, and
  one-shot effects.
- Prefer `presentation/component/NeoBrutalist.kt` and `ui/theme/` before
  creating new visual primitives.
- Do not edit Android generated/build outputs such as `R`, `BuildConfig`,
  KSP output, or `build/`.

## Wrapper Standards

- Contracts are Zod schemas in `src/contracts/`.
- Routes should parse/validate request bodies before calling services.
- Services own use-case behavior and call workspace adapters.
- Workspace adapters own file format and safe IO details.
- Security helpers own path containment, redaction, and local pairing token
  behavior.
- Do not expose generic shell endpoints such as `/run`, `/exec`, or
  `/command`.
- Scan execution must go through typed Career Ops engine operations.
- Do not edit `dist/`; build from TypeScript source.

## API Contract Standards

- Keep wrapper APIs versioned under `/api/v1`.
- Add or update `contracts/examples/` when response shapes change.
- Android DTO tests should use checked-in examples where practical.
- Use stable error codes from the shared error contract.
- Never expose raw local filesystem paths through Android-facing API payloads.

## Security Standards

- Do not commit `.env`, provider API keys, pairing tokens, release keystores,
  local workspace paths, or real CV/profile content.
- Localhost wrapper mode may be unauthenticated for setup diagnostics.
- LAN/private wrapper mode must require `X-Career-Ops-Token` for protected
  routes.
- Logs and startup errors must redact sensitive text.
- Android should store only endpoint/token configuration needed for local use,
  not workspace paths or shell details.

## Testing Standards

| Change | Check |
| --- | --- |
| Android DTO/API/repository logic | `cd android && ./gradlew testDevDebugUnitTest` |
| Android UI-only layout | `cd android && ./gradlew assembleDevDebug` |
| Android Gradle/flavor/manifest | `cd android && ./gradlew assembleDevDebug` plus relevant lint/test |
| Android Kotlin formatting/static analysis | `cd android && ./gradlew qualityCheck` |
| Wrapper contract/service/security | `cd career-ops-wrapper && npm test` |
| Wrapper TypeScript build/openapi | `cd career-ops-wrapper && npm run build` |

Add one focused test for new branches, parsing, persistence, network mapping,
or security-sensitive behavior.

## Documentation Standards

- Root `docs/` describes the whole product workspace.
- Subproject docs describe local commands and implementation details.
- Keep `README.md`, `docs/`, `AGENTS.md`, and `CLAUDE.md` aligned when project
  structure or commands change.
- Prefer concise tables and command blocks over long prose.
