# 13. Keep auth self-contained, with one session source and no hard tie to Firebase

Status: Accepted (2026-11-05)

Its guest, linking and session parts are superseded by [ADR 15](0015-sign-in-through-the-backend-and-keep-only-its-session.md).
The code still follows this ADR until the Android change for ADR 15 lands.

## Context

The first auth layer worked but had no app-wide session: only Settings knew who was signed in, any API call could create
a guest as a side effect, and a session could change without anyone being told. The owner wants this feature stable,
movable to other projects, and free of a hard tie to Firebase. Signing in also spans two systems, Firebase and the backend,
which share no transaction.

## Decision

**Layers.** `AuthenticationService` in `domain/auth` is the only way in: `session`, `isBusy`, `signIn(method)`, `signOut()`.
Its implementation in `data/auth` runs `GuestSignIn` or `GoogleSignIn`, chosen by `when` on a sealed `SignInMethod`, so a new
method does not compile until it is handled. There is no registry, because the methods take different input.

**One vendor boundary.** `IdentityProvider` and `InstallationIdSource` are the only ties to the vendor. Everything that
imports Firebase is in `data/auth/firebase`, and `di/AuthFirebaseModule.kt` picks it; Konsist enforces both. Nothing above the
boundary knows `linkWithCredential`: before switching accounts, the adapter only hands over the guest token to keep, and then the account it landed on. Changing how linking works means
changing the adapter, and changing vendor means another adapter and, on the backend, another `AuthVerifier`.

**A session means the backend confirmed it.** A sign-in is a saga: provider, then the auth API. If the API fails after the
provider succeeded, the app signs out with the provider on the device only, without calling `/auth/logout`, and the user tries
again. The session is held back until the end, so nobody sees an unconfirmed user. `PendingLogin` marks the sign-in on disk, so
one cut off by the app dying is rolled back on the next launch, unless it was a Google sign-in and the user is still anonymous:
the provider never moved, and signing out would lose that guest for good. A mark that cannot be read counts as no mark, for the
same reason: when unsure, never risk someone's identity. A sign-in whose mark cannot be written does not start. It also keeps the guest token, because after a switch there is no
way back to the guest. The token is written before the switch and tied to the account the switch lands on, and is sent only for
that account, so the next person on a shared device cannot receive the guest's data. This applies only to signing in: a signed-in user is never signed out for a network failure or a 5xx.
Only an account the vendor no longer accepts ends a session, and the service does that.

**Upgrading keeps the uid.** A guest links Google with `linkWithCredential`, so no data moves. Only when that Google account
already exists does the backend merge, because merging is the riskiest thing it does and belongs off the common path.

**State lives where its scope is.** The service owns what every screen must agree on: the session and `isBusy`. It runs commands
on the application scope behind a `Mutex`, so leaving a screen cannot cut a saga, and a session ended from outside the UI
waits its turn. Each screen has its own thin `AuthViewModel` (MVI, no effects, since navigation follows the session) holding only
its error and its sign-in in progress.

**The client never deletes an account.** It may call `DELETE /me`; the backend decides and does the rest.

**Boundaries.** Auth lives in `domain/auth`, `data/auth`, `ui/auth`, `di/AuthModule.kt` and `di/AuthFirebaseModule.kt`, and
imports only itself, `core/common` and `core/mvi`. The rest of the app plugs in through `SessionObserver` with `@IntoSet`, which
runs before a new session is published and only when the uid changes. `domain/auth` is a deliberate exception to `domain/model`
and `domain/repository`: splitting auth by kind would scatter what must move together.

Rejected: a top-level `auth/{domain,data,ui}` (a second way to lay out code, and the layer rules would not scan it); a
`:core:auth` Gradle module now (no second project yet, and moving these folders later is cheap, see ADR 5); a use case per
command (pass-throughs); retrying the API silently after the provider succeeded (it leaves a half signed-in state every screen
would have to handle); an Activity-scoped `AuthViewModel` (an error follows the user across screens, callers outside the UI
get past its guard, and auth could not move to an app without a single Activity); always merging instead of linking (a backend
failure on the common path would risk the guest's data); a 30-day guest lifetime through Firebase's clean-up (it goes by age, so
it deletes guests still using the app).

## Consequences

Session rules are tested on the JVM with fakes, and the SDK's real behaviour against the Auth emulator. A new per-user table adds
one observer. To reuse auth, copy those folders, `core/common`, `core/mvi` and the `error_auth_*` strings, then provide the
application scope, add the token classes to the OkHttp client, and pass the web client id to `requestGoogleIdToken`.

A bad connection during a sign-in costs more: a guest who was linking is signed out, cannot return to being a guest, and must
sign in with Google again, which finds the same uid. A guest who was switching has only the kept token, which lasts about an hour.
If the app cannot record the account a switch landed on, or dies first, the token is never sent and that guest's data stays
behind: sending it to the wrong person would be worse. Any sign-out on the device also clears the token.
No abstraction covers changing vendor fully: `users.auth_subject` holds the vendor's uid, so it needs a data migration, everyone
must sign in again, and a vendor without anonymous sign-in needs the backend to issue guests. `SettingsScreen` also reads
`default_web_client_id`, which the google-services plugin generates, so dropping the plugin means supplying that id another way. The boundary is only as strong as
Konsist until a module exists.

Follow-up, with the Get Started screen: a gate that shows the sign-in flow or `key(uid) { MainGraph() }`. Clearing and re-adding
a route keeps its ViewModel when the key stays on the back stack, so a change of user needs `key`.
