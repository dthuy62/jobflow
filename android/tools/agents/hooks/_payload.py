"""Shared helpers for agent hooks: read the hook payload and locate the files a tool call writes."""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(os.environ.get("AGENT_HOOKS_PROJECT_ROOT") or Path(__file__).resolve().parents[3]).resolve()

_PATCH_FILE_HEADER = re.compile(r"^\*\*\* (?:Add|Update|Delete) File: (.+)$")
_PATH_KEYS = ("file_path", "path", "filePath")


def read_payload() -> dict | None:
    """The hook payload from stdin, or None when stdin is empty or not a JSON object."""
    try:
        data = json.loads(sys.stdin.read() or "null")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    return data if isinstance(data, dict) else None


def target_paths(payload: dict) -> list[Path]:
    """Absolute paths a tool call writes: Claude Code passes file_path, Codex apply_patch passes a patch command."""
    tool_input = payload.get("tool_input")
    if not isinstance(tool_input, dict):
        return []
    raw: list[str] = []
    for key in _PATH_KEYS:
        value = tool_input.get(key)
        if isinstance(value, str) and value.strip():
            raw.append(value.strip())
    command = tool_input.get("command")
    if isinstance(command, str):
        for line in command.splitlines():
            match = _PATCH_FILE_HEADER.match(line.rstrip())
            if match:
                raw.append(match.group(1).strip())
    cwd = Path(payload.get("cwd") or os.getcwd())
    paths: list[Path] = []
    for item in raw:
        path = Path(item)
        resolved = (path if path.is_absolute() else cwd / path).resolve()
        if resolved not in paths:
            paths.append(resolved)
    return paths


def project_relative(path: Path) -> str | None:
    """POSIX path relative to the project root, or None for files outside the project."""
    try:
        return path.relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        return None


def generated_hint(rel: str) -> str | None:
    """Why a project-relative path is generated and what to edit instead, or None for source files."""
    parts = rel.split("/")
    if rel == "gradle/wrapper/gradle-wrapper.jar":
        return "the Gradle wrapper; change the version with ./gradlew wrapper --gradle-version <version>."
    if parts[0] in (".gradle", ".kotlin"):
        return "a Gradle/Kotlin cache; it is rebuilt automatically."
    if len(parts) > 2 and parts[0] == "app" and parts[1] == "schemas":
        return "Room exports this from @Database classes; change the entity/DAO and rebuild."
    for part in parts[:-1]:
        if part == "src":
            return None
        if part == "build":
            return "build output; change the source file that produces it."
    return None
