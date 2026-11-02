# Deployment Guide

## Hosted Backend, Local Development

Everything runs in Docker Compose, with development-only passwords.

```bash
docker compose up -d --build api
curl http://127.0.0.1:8080/api/v1/health
```

This starts PostgreSQL, runs the migrations once with the owner role, then starts the API with
the app role. All ports bind to `127.0.0.1`.

To run the backend's tests, start only the database:

```bash
docker compose up -d postgres
npm test -w @jobflow/backend
```

Each test file creates its own database.

To run the API outside Docker, with PostgreSQL still in Compose:

```bash
cp backend/.env.example backend/.env
npm run migrate -w @jobflow/backend
npm run dev -w @jobflow/backend
```

Stop Docker when done, because it uses a lot of memory:

```bash
docker compose down
```

### Rules For A Deployed Database

- Two roles: an owner that runs migrations, and an app role with no right to change the schema.
- The owner role must own the database. Since PostgreSQL 15, only the database owner can create
  objects in `public`.
- Migrations are a separate step (`node backend/dist/db/migrate-cli.js`, with
  `DATABASE_MIGRATION_URL` and `JOBFLOW_ENV`), never run at API start. The API never holds the
  owner's URL.
- `JOBFLOW_ENV=production` refuses a database URL that holds a development password, in both
  steps.
- Set `TRUST_PROXY` to the real number of proxies in front of the API, or leave it at `0`. A
  higher number lets clients forge their address and dodge rate limits.

## Wrapper, Local Development

Install and run the wrapper:

```bash
npm ci
cd career-ops-wrapper
npm run dev -- --workspace /path/to/career-ops
```

Check health:

```bash
curl http://127.0.0.1:3000/api/v1/health
```

Open API docs:

```text
http://127.0.0.1:3000/docs
http://127.0.0.1:3000/openapi.json
```

Run Android checks:

```bash
cd android
./gradlew testDevDebugUnitTest
./gradlew assembleDevDebug
```

## Wrapper Runtime Config

Configuration order is CLI flags, `.env`, then defaults.

```env
CAREER_OPS_HOST=127.0.0.1
CAREER_OPS_PORT=3000
CAREER_OPS_PAIRING_TOKEN=
CAREER_OPS_EVALUATION_PROVIDER=
```

Use localhost mode for emulator development. Use LAN/private mode only with a
pairing token.

AI offer evaluation is off until `CAREER_OPS_EVALUATION_PROVIDER=claude` is
set. Before enabling it, log in the desktop CLI once in a normal terminal
(`claude auth login`; `claude auth status` should show `"loggedIn": true`).
Each evaluation uses the desktop's Claude subscription quota. It works in
localhost and LAN mode; in LAN mode the pairing token guards it like every
other protected route, and health shows whether it is ready.

## Android Build Variants

| Variant | Purpose |
| --- | --- |
| `devDebug` | Default local development and emulator testing |
| `prodDebug` | Prod resources with debug signing |
| `prodRelease` | Release signing path, not yet a public deployment target |

`dev` allows cleartext traffic to `10.0.2.2` and `localhost` through
`app/src/dev/res/xml/network_security_config.xml`.

## Release Signing

Release signing reads:

```text
KEYSTORE_PATH
STORE_PASSWORD
KEY_PASSWORD
```

Do not commit release keystores or passwords. `android/debug.keystore` is for
debug builds only.

## Production Caveats

- The wrapper is currently local/private, not a hosted multi-user backend.
- Prod Android base URL is still a placeholder and must not be treated as a
  real production backend.
- Firebase/App Check/cloud auth are not part of the current MVP.
- Scan and AI evaluation run only on the desktop that hosts the wrapper.
