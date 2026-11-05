# 13. Keep auth self-contained, with one source for the session

Status: Accepted (2026-11-05)

## Context

The first auth layer worked but had no app-wide session: only Settings knew who was signed in, any API call could create
a guest as a side effect, and a session could change without anyone being told. The owner also wants this feature to
move to other projects. Firebase Auth, Credential Manager, the feed cache and `GET /me` were mixed in one repository, so
it could neither be tested without Firebase nor be moved.

## Decision

- `AuthRepository.session` is the only source of who is signed in. It comes from Firebase's token listener, which is
  documented to report token changes and which we tested against the Auth emulator for linking. It is known offline, so
  navigation reads it, not `GET /me`.
- `FirebaseIdentityProvider` is the only class that calls Firebase Auth, behind `IdentityProvider`. Fetching a token never
  creates a user. A guest starts only through `continueAsGuest()`, once per install (`GuestPolicy`).
- A failed command returns an error and leaves the session alone. A session that changes for any other reason is only a
  new `session` value. Only an account Firebase no longer accepts ends a session: for a guest, losing it loses their
  identity for good.
- Auth lives in `domain/auth`, `data/auth`, `ui/auth` and `di/AuthModule.kt`, and imports only itself and `core/common`.
  Konsist enforces it. The rest of the app plugs in through `SessionObserver` (with `@IntoSet`), so a new per-user table
  registers its own cleanup without changing auth. `GET /me` moved to `AccountRepository`, which belongs to JobFlow.
- `domain/auth` is a deliberate exception to `domain/model` and `domain/repository`: splitting auth by kind would scatter
  what must move together.

Rejected: a top-level `auth/{domain,data,ui}` (a second way to lay out code, and the layer rules would not scan it); a
`:core:auth` Gradle module now (no second project yet, and moving these folders into one later is cheap, see ADR 5); use
cases for each command (pass-throughs; `SignInWithGoogle` earns one when it has to combine sign-in with the guest merge).

## Consequences

Session rules are tested on the JVM with a fake, and the SDK's real behaviour against the Auth emulator. A new per-user
table adds one observer. To reuse auth in another project, copy those folders, `core/common` and the `error_auth_*` strings,
then pass the web client id to `requestGoogleIdToken`. The boundary is only as strong as Konsist until a module exists.
