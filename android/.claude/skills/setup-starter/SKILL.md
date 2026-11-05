---
name: setup-starter
description: Use for first-time setup of a project made from this starter, or when changing the app name, package/applicationId, project name, flavors or Firebase.
---

# Set up the starter

Identity and build configuration change only through the mobile-app-config plugin (`/mobile-app-config:android`
in Claude Code, or the `mobile-app-config` CLI). Never edit `namespace`, `applicationId`, package folders or
`app_name` by hand. If the CLI is missing: `pipx install git+https://github.com/dthuy62/mobile-app-config.git`.

1. Ask for: app name, applicationId (reverse domain, e.g. `com.acme.notes`), root project name (kebab-case),
   whether to add `dev`/`stg`/`prod` flavors, and whether the app uses Firebase.
2. Rename: `mobile-app-config package-name --application-id <id> --app-name "<name>" --root-project-name "<project>"`.
3. Flavors, if wanted: `mobile-app-config flavors`, then `mobile-app-config validate-flavors`.
4. Firebase, if wanted (needs `firebase login`): `mobile-app-config firebase --mode single --project <project-id>`,
   or `--mode per-flavor --flavor dev=<id> --flavor stg=<id> --flavor prod=<id>`.
5. Verify: `./gradlew assembleDevDebug testDevDebugUnitTest lintDevDebug detekt ktlintCheck` (JobFlow has `dev` and
   `prod` flavors, so Android tasks are per variant).
6. If the user changes a default decision recorded in `docs/decisions/`, write a new ADR with skill `adr`.
