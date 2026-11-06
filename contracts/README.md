# Hosted API Contract

The boundary between the Android app and the hosted backend.

| Path | What it is |
| --- | --- |
| `packages/contract/src/` | Source of truth: Zod schemas and the `operations` table |
| `examples/` | One JSON file per example, all synthetic. `errors/` has one per error code; `requests/` holds request bodies |
| `error-codes.json` | The error codes, for clients to mirror |
| `openapi.json` | Generated. Do not edit by hand |

This is a draft of the first release. Each operation has an `x-phase`: the phase of the
hosted design that ships it. Later phases may refine shapes through their own contract PRs.

## Change the contract

1. Edit the schema or `operations`, and the examples.
2. Run `npm run gen -w @jobflow/contract`.
3. Run `npm test -w @jobflow/contract`. It fails if `openapi.json` is out of date, or if a
   documented status has no example.

## Run the mock

The mock serves these examples, so the app can be built before the backend exists. It needs
Docker. The image is amd64 only, so it is emulated on Apple Silicon.

```bash
docker compose --profile mock up -d mock
```

The emulator reaches it at `http://10.0.2.2:4010`; from this machine use
`http://127.0.0.1:4010`.

```bash
# 401: no token
curl -s -o /dev/null -w '%{http_code}\n' localhost:4010/api/v1/feed
# the first example of the first success status
curl -s -H 'Authorization: Bearer x' localhost:4010/api/v1/feed
# a chosen status
curl -s -H 'Authorization: Bearer x' -H 'Prefer: code=404' localhost:4010/api/v1/jobs/x
# a chosen example: the file's name, with "." in place of "/"
curl -s -H 'Authorization: Bearer x' -H 'Prefer: code=503, example=errors.auth-unavailable' localhost:4010/api/v1/me
```

Any bearer token works: the mock checks only that one is present. The auth routes that start or
renew a session need none. It does not store anything,
so a `PUT` does not change a later `GET`.

The mock is not the server for a request it finds invalid: it answers with the first
documented 4xx that fits, or its own 422. For example, an import with no file gets
`CV_UNREADABLE`, where the server sends `VALIDATION_ERROR`, and an evaluation with no integrity
token gets `VALIDATION_ERROR`, where the server sends `INTEGRITY_FAILED`. To test an error
path, choose it with `Prefer`.

Prove the mock serves every documented status and example:

```bash
npm run mock:smoke -w @jobflow/contract
```

## Rules for the backend

The schemas limit stored text from job sources and AI, such as a title's length or a currency
code. One bad row would fail a whole feed page if a response were the first place it was
checked. So scan and evaluator workers normalize each value and validate against
`JobDtoSchema` or `EvaluationDtoSchema` before writing, and clip or skip what still fails.

## Rules the app relies on

- Errors are `{ "error": { "code", "message", "details"? } }`. Branch on `code`, not `message`.
- `401 UNAUTHORIZED` on a call with a Bearer means the access token is not accepted: refresh
  once and retry once. `401` from `POST /auth/refresh` means the session has ended: sign in
  again. `503 AUTH_UNAVAILABLE` or `503 UNAVAILABLE` means a check could not run: retry and keep
  the session.
- Sessions: `POST /auth/guest` or `POST /auth/sso` returns `tokens`. Send `accessToken` as the
  Bearer. It expires `expiresIn` seconds after the answer arrived; refresh shortly before. Each
  `refreshToken` works once: replace both tokens with every answer, and run one refresh at a
  time. If a refresh answer is lost, sending the same token again works. Sending an older token
  after its successor was used ends the session.
- `POST /auth/guest` makes a new guest on each call, so call it once per install and keep the
  pair. A guest has no sign-out: `POST /auth/logout` answers it with 403.
- `POST /auth/sso` with `guestRefreshToken` moves that guest's data and ends the guest's
  session. It is safe to retry with the same body, also after a merge whose answer was lost.
  `guestMerged` false with a 200 means no data moved, and the sign-in still worked.
- A merged guest's tokens get 401 like any revoked session.
- Lists are `{ "items", "nextCursor" }`. `nextCursor` is opaque and null on the last page.
- Ids and cursors are opaque strings of letters, digits, `.`, `_` and `-`, starting with a
  letter or digit. A backend that encodes a cursor must keep to this, for example with hex.
- A field with no value is an explicit `null`, not absent. Only `importId` in `PUT /me/cv`,
  `guestRefreshToken` in `POST /auth/sso` and `details` in an error may be absent. Send `null` to
  clear `aim`; an empty string is a 400. `"guestRefreshToken": null` is a 400: leave it out.
- Links are `http` or `https` with no user info. Still open them as untrusted, because job
  sources supply them.
