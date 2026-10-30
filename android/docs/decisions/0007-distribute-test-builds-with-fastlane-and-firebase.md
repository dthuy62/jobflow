# 7. Distribute test builds with fastlane and Firebase App Distribution

Status: Accepted (2026-10-17)

## Context

Testers need a signed build after every merge without anyone running a script. The starter targets teams that test an
APK before any store release. The Firebase Gradle plugin documents no AGP compatibility statement, and this repository
is on AGP 9, where another Gradle plugin (ktlint) already needed an upgrade to work. The starter must also stay green
on a fresh clone with no Firebase project.

## Decision

Merging into `develop` triggers `distribute.yml`: it reuses the CI checks, then runs the fastlane lane
`android distribute`, which builds the signed release APK with Gradle and uploads it with the
`firebase_app_distribution` plugin. Signing and Firebase credentials live in a GitHub Environment limited to `develop`;
the Firebase app id is a repository variable, and when it is unset the distribution job is skipped. `versionName` is
bumped by hand, `versionCode` comes from the workflow run number, and release notes are the commit subjects since the
previous `build-*` tag. Authentication is a service account JSON key.
Rejected: the Firebase Gradle plugin (AGP 9 compatibility unknown); calling `firebase-tools` or a community action
directly (no lane that also runs locally, no path to Play Store uploads); AAB (needs Google Play linking); deriving
`versionCode` from Firebase (an extra authenticated call, and the first build has nothing to read).

## Consequences

The pipeline is decoupled from AGP internals, and the same `fastlane android build_release` runs on a laptop and on CI.
The repository gains a Ruby toolchain (Bundler, `Gemfile.lock`, `.ruby-version`) next to the JVM and the Python used by
agent hooks, only needed when running the lanes. The service account key is a long-lived secret, so branch protection,
Code Owners and the environment's branch restriction matter. R8 is enabled with empty custom rules, so the first
distributed APK needs a manual smoke test. Store releases, AAB, keyless authentication and AI-written release notes are
future decisions.
