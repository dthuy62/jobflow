# 6. Use Room 3

Status: Accepted (2026-10-17)

## Context

The starter began on Room 2.8.5, which is the last release of the 2.x line. Room 3 (`androidx.room3`) reached stable
3.0.0 in mid-2026 and is at 3.0.3; the official Room documentation now describes it. It is Kotlin-only and KSP-only,
uses `SQLiteConnection` and a `SQLiteDriver` instead of SupportSQLite, and moves everything to new packages and
artifacts. The starter's database is small (one entity at version 1) and has never shipped, so now is the cheapest time
to move.

## Decision

Use `androidx.room3:room3-runtime` and `room3-compiler` (via KSP) at one shared version, and the `androidx.room3` Gradle
plugin with `room3 { schemaDirectory("$projectDir/schemas") }`. There is no `room3-ktx`; coroutines support is built
in. On Android Room 3 uses `AndroidSQLiteDriver` by default, so no driver is configured. Stay off the 3.1 alpha line.
Rejected: staying on Room 2.8.5 (no further 2.x releases to follow, and new documentation targets Room 3).

## Consequences

The generated identity hash for the existing schema is unchanged, so the exported `1.json` and any installed database
stay valid. Konsist's "domain must not import Room" rule now covers both `androidx.room.` and `androidx.room3.`.
Migrations and callbacks receive `SQLiteConnection`, and migration tests use `room3-testing`; see
`docs/module-guides.md`. Libraries and samples written for Room 2 will not compile unchanged.
