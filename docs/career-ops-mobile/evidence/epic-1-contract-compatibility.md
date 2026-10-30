# Epic 1 contract compatibility evidence

Date: 2026-07-13

## Scope

This note records contract fixtures and parser compatibility checks for the
local Career Ops wrapper and Android client. Fixture values are synthetic and
contain no workspace paths, pairing tokens, secrets, or real profile data.

## Backend startup and health behavior

The wrapper is started with the existing local development command and exposes
the versioned API under `/api/v1`. The checked-in `health.ready.json` fixture
shows `status: "ready"`, a detected workspace, ready scanner checks, and
capabilities that keep scan, reports, and artifacts disabled until their later
stories are implemented. `health.not-ready.json` records the corresponding
safe readiness response when requirements are missing.

## Contract checks

The backend Zod contract test loads the same checked-in examples used by the
Android unit test. It covers Health, Error, Collection, CV, Profile, Portal,
Offer, ScanRun, Report, and Artifact, including unauthorized, validation,
workspace-not-ready, path-boundary, and scan-conflict errors.

Commands run:

```text
cd career-ops-wrapper && npm test
cd career-ops-wrapper && npm run build
cd android && ./gradlew testDevDebugUnitTest
```

The Android parser uses the production `kotlinx.serialization` configuration
with `ignoreUnknownKeys = true`. Required fields and wrong types fail; omitted
or explicit-null optional fields parse according to each DTO's contract.

This evidence proves contract compatibility only. Scan execution, offer
projection, reports, and artifacts are not implemented or claimed as complete
by Epic 1.
