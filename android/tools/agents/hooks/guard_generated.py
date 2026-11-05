#!/usr/bin/env python3
"""PreToolUse hook: deny edits to generated files and say which source to change instead."""
from __future__ import annotations

import json
import sys

from _payload import generated_hint, project_relative, read_payload, target_paths


def main() -> int:
    payload = read_payload()
    if payload is None:
        return 0
    reasons = []
    for path in target_paths(payload):
        rel = project_relative(path)
        hint = generated_hint(rel) if rel else None
        if hint:
            reasons.append(f"{rel} is generated: {hint} Edit the source instead.")
    if reasons:
        json.dump(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": " ".join(reasons),
                }
            },
            sys.stdout,
        )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:  # a broken hook must never block the agent
        sys.exit(0)
