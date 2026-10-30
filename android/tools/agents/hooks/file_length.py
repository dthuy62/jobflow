#!/usr/bin/env python3
"""PostToolUse hook: tell the agent when an edited Kotlin file grows past the size limit."""
from __future__ import annotations

import json
import sys

from _payload import generated_hint, project_relative, read_payload, target_paths

LIMIT = 400
_KOTLIN_SUFFIXES = (".kt", ".kts")


def main() -> int:
    payload = read_payload()
    if payload is None:
        return 0
    messages = []
    for path in target_paths(payload):
        rel = project_relative(path)
        if rel is None or generated_hint(rel) or path.suffix not in _KOTLIN_SUFFIXES or not path.is_file():
            continue
        lines = len(path.read_text(encoding="utf-8", errors="replace").splitlines())
        if lines > LIMIT:
            messages.append(
                f"{rel} has {lines} lines (limit {LIMIT}). Split it: extract a use case or sub-composables."
            )
    if messages:
        json.dump(
            {"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": " ".join(messages)}},
            sys.stdout,
        )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:  # a broken hook must never block the agent
        sys.exit(0)
