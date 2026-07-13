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
```

Use localhost mode for emulator development. Use LAN/private mode only with a
pairing token.

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
- Scan execution endpoints are not implemented yet.
