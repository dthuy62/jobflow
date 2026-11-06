# 15. Sign in through the backend and keep only its session

Status: Accepted (2026-11-06)

Supersedes the guest, linking and session parts of [ADR 13](0013-keep-auth-self-contained-with-one-session-source.md).
Its layers, vendor boundary, `SessionObserver` and the rule that a network failure never signs anyone out stay.

## Context

ADR 13 kept the guest in Firebase as an anonymous user. An anonymous user cannot sign in again once its session is gone,
so every edge of the upgrade needed a fix: a Google account already in use meant switching users instead of linking, the
guest's data could only be reached through an ID token that lasts an hour, a failed backend call left that token on a
signed-out device, so it had to be tied to one account, and sign-out had to decide whether to clear it. The data itself
already lives on the backend, so Firebase gave the guest nothing but an identity the app could lose.

The backend design (hosted product spec, "Accounts, payment and abuse protection", 2026-11-06) now creates guests and
issues its own sessions. Firebase only signs people in.

## Decision

**The session is the backend's token pair.** The app stores the access token, the refresh token and when the access
token expires, in the auth DataStore, which backup and device transfer exclude. `Session` comes from that store alone:
a member's pair is `Member`, a guest's pair is `Guest`, no pair is `SignedOut`. The app keeps nothing from Firebase and
signs out of it right after each sign-in.

**Firebase only answers "who is this".** `IdentityProvider` shrinks to one job: sign in with a credential and return a
Firebase ID token, then sign out. Firebase stays in `data/auth/firebase` behind it, so Apple or email link is another
`SignInMethod` and another provider call, and changing vendor touches only that adapter and the backend's
`IdentityVerifier`. `InstallationIdSource` stays for device rows.

**Sign-in.**
- Guest: `POST /auth/guest`, keep the pair. One guest per install stays a device rule (`GuestLedger`).
- Google: the screen first says the guest's data will move to this account. Then Firebase gives an ID token, and
  `POST /auth/sso` sends it with the guest's refresh token. The new pair replaces the guest's in one write.
- If anything fails, nothing is written: the app is still the guest it was, and the user tries again. `/auth/sso` is
  safe to retry, also after a merge whose answer was lost. `PendingLogin`, the kept guest token and its target, and the
  start-up rollback go away.

**Refresh.** Before a request, if the access token has less than 60 seconds left, the app refreshes first; 60 seconds
covers the request's flight and some clock difference. The deadline is the receipt time plus `expiresIn`, never `exp`
read against the device clock. A 401 also refreshes once and retries the request once, because a token can end early
(a key rotation, a slept device). Both paths share one lock, so one refresh runs at a time. A refresh answered with
401 ends the session; a network failure or a 5xx keeps it.

**Sign-out.** A member calls `/auth/logout`, best effort, then drops the pair. A guest has no sign-out, because it would
lose their data.

Rejected:
- Keep the guest in Firebase and fix each edge (ADR 13): every fix guarded a state the design created.
- A guest secret next to Firebase tokens for members: two kinds of bearer, and the app still tracks Firebase state.
- Encrypting the tokens with a Keystore key: it only helps against files copied off a rooted device, and a Keystore
  failure on some devices would lose a guest's data. Private storage without backup is the normal consumer-app level.
- Refreshing on a background timer: it does not run reliably in the background and refreshes when nobody uses the app.

## Consequences

The app gets simpler: one token source, one interceptor, one authenticator, no linking, no switch, no rollback on
start-up. The SDK tests against the Auth emulator shrink to signing in and returning a token.

The backend becomes a small auth server: signing keys and revocation. The refresh token is not rotated (owner,
2026-11-06): it stays the same for the session, so the app only ever replaces the access token. It is reviewed as a
security change.

A lost refresh token is a lost guest. That is the same as before, when it was a lost Firebase anonymous user.

Follow-ups: the sign-in screen with the merge notice, `DELETE /me` for a guest who wants to leave, and Play Integrity on
`/auth/guest` if guests are abused.
