# 4. Change identity via mobile-app-config

Status: Accepted (2026-10-15)

## Context

Every project made from the starter must change its package, applicationId, app name and project name. Hand edits
miss files (test packages, Room schema folders, imports), and agents repeat the same mistakes.

## Decision

Identity changes go through the `mobile-app-config` plugin (`package-name` command or `/mobile-app-config:android`).
Template class names carry no project name (`MainApplication`, `AppTheme`, `Theme.App`) so the plugin covers the
whole rename. Rejected: a starter-specific rename script (duplicates the plugin).

## Consequences

Renaming is one tested command that agents can run. The starter depends on an external plugin repository; the
README documents installing it.
