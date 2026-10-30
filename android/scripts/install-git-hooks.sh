#!/usr/bin/env bash
# One-time setup per clone: use the versioned hooks in scripts/git-hooks.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
chmod +x "$ROOT"/scripts/git-hooks/*
git -C "$ROOT" config core.hooksPath scripts/git-hooks
echo "Git hooks enabled (core.hooksPath = scripts/git-hooks)."
