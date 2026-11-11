# 17. Group closely related small types in one file named after the main type

Status: Accepted (2026-11-11)

## Context

Auth had 25 files for about 1,000 lines: one file per sealed type, value class, interface, mapper and helper, and three
classes (`GuestSignIn`, `GoogleSignIn`, `BackendLogout`) that each had one caller and no other implementation. Reading one
flow meant opening many files, and the owner, who is learning Android, found the feature bulky. Kotlin allows several
top-level declarations per file, and ktlint asks a file to match its class's name only when it holds one class.

## Decision

Types that are read and changed together share one file, named after the main type: the one the others exist for. A
mapper lives with the type it reads (`DataSourceError.toAuthError()` in `AuthApi.kt`), a qualifier and its helpers with the
store that uses them, an interface with its only caller when nothing else uses it, and a feature's domain types with its
service. A class with one caller and no second implementation becomes private functions of that caller.

Packages, layers and Konsist rules do not change: grouping never moves a type across a package. Rejected: one file per
type (what made auth bulky), and splitting `data/auth` into `remote` and `local` (more folders for the same code).

## Consequences

Auth went from 25 files to 10. One flow reads in one file, and a reader finds a type by opening the file of the type it serves.

A file still splits past ~400 lines ([code standards](../code-standards.md)), and a type that gets a second user or a second
implementation can move to its own file again. Finding a type by file name works less often, so search by symbol.

`di/AuthFirebaseModule.kt` is merged into `di/AuthModule.kt` (owner, 2026-11-11). Konsist exempts the vendor module by
file name, so the exemption moved to `AuthModule`: all of auth's wiring may now import Firebase and the adapter, not only
the vendor bindings. Every other file is still held to the rule.
