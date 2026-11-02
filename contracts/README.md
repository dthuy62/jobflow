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

Any bearer token works: the mock checks only that one is present. It does not store anything,
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

## Rules the app relies on

- Errors are `{ "error": { "code", "message", "details"? } }`. Branch on `code`, not `message`.
- `401 UNAUTHORIZED` means sign in again. `503 AUTH_UNAVAILABLE` means the check could not
  run: retry and keep the user signed in.
- Lists are `{ "items", "nextCursor" }`. `nextCursor` is opaque and null on the last page.
- Ids are opaque strings of letters, digits, `.`, `_` and `-`.
- A field with no value is an explicit `null`, not absent. Only `importId` in `PUT /me/cv`
  and `details` in an error may be absent. Send `null` to clear `aim`; an empty string is a
  400.
- Links are `http` or `https` with no user info. Still open them as untrusted, because job
  sources supply them.
