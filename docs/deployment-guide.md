# Deployment Guide

## Local Development

Install and run the wrapper:

```bash
cd career-ops-wrapper
npm install
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
