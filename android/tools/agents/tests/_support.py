"""Helpers shared by the agent-layer tests."""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
HOOKS_DIR = REPO_ROOT / "tools" / "agents" / "hooks"


def run_hook(
    script: str,
    project_root: Path,
    payload: dict | None = None,
    raw: str | None = None,
) -> subprocess.CompletedProcess[str]:
    """Run a hook script as the agent would: payload JSON on stdin, project root via env."""
    env = {**os.environ, "AGENT_HOOKS_PROJECT_ROOT": str(project_root)}
    stdin = raw if raw is not None else json.dumps(payload)
    return subprocess.run(
        [sys.executable, str(HOOKS_DIR / script)],
        input=stdin,
        text=True,
        capture_output=True,
        env=env,
        check=False,
    )
