# Deployment Guide

## Hosted Backend, Local Development

Everything runs in Docker Compose, with development-only passwords.

```bash
docker compose up -d --build api worker
curl http://127.0.0.1:8080/api/v1/health
docker compose logs worker
```

This starts PostgreSQL, runs the migrations once with the owner role, then starts the API and
the worker with the app role. The worker logs a heartbeat every minute. All ports bind to
`127.0.0.1`. To rebuild the image alone, use `docker compose build migrate`, the one service
that builds it.

To run the backend's tests, start only the database:

```bash
docker compose up -d postgres
npm test -w @jobflow/backend
```

Each test file creates its own database. Without the owner's Firebase project, real ID tokens
cannot be tried yet; set `FIREBASE_PROJECT_ID` to it when it exists. Guests, refresh and logout
need no Firebase at all.

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
  `DATABASE_MIGRATION_URL` and `JOBFLOW_ENV`), never run at API start. The API and the worker
  never hold the owner's URL. This step also installs pg-boss, in the `pgboss` schema, and creates
  each queue, so run it before starting a release that adds a job. A pg-boss upgrade can queue
  index builds, which this step waits for, up to 30 minutes; it fails if one fails.
- Run the worker with `node backend/dist/worker.js`, with `DATABASE_URL` and `JOBFLOW_ENV`. It
  exits 1 if it cannot run, so give it a restart policy. On SIGTERM it waits up to 30 seconds for
  running jobs, so allow it longer than that before a kill; a job cut off is retried.
- `JOBFLOW_ENV=production` refuses a database URL that holds a development password, in both
  steps.
- Set `TRUST_PROXY` to the exact number of proxies in front of the API, and to `0` only when
  clients connect directly. Too high lets clients forge their address and dodge rate limits.
  Too low, as on most cloud hosts if left unset, puts every user under one IP limit, including
  the platform's health check.
- Limit malformed requests at the host or proxy, because the API refuses them before its own
  rate limits run.
- Set `FIREBASE_PROJECT_ID` to the real project. Production refuses a `demo-` project.
- Turn off anonymous sign-in in that project: the backend creates guests itself.
- Set `JWT_SIGNING_KEYS` to `kid:secret` pairs, comma-separated, each secret at least 32
  characters (`openssl rand -base64 32`). It is a secret: anyone holding it can sign in as any
  user. Production refuses a `dev-only-` secret. To rotate, put a new pair first and keep the old
  one after it for at least 15 minutes, the access tokens' life, then remove it. Removing a key
  early only makes its holders refresh; it signs no one out.

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
