from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from ._support import run_hook

SCRIPT = "guard_generated.py"


class GuardGeneratedTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name).resolve()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def edit(self, file_path: str) -> dict:
        return {"hook_event_name": "PreToolUse", "tool_name": "Edit", "cwd": str(self.root),
                "tool_input": {"file_path": file_path}}

    def assert_denied(self, result, *fragments: str) -> None:
        self.assertEqual(result.returncode, 0, result.stderr)
        output = json.loads(result.stdout)["hookSpecificOutput"]
        self.assertEqual(output["hookEventName"], "PreToolUse")
        self.assertEqual(output["permissionDecision"], "deny")
        for fragment in fragments:
            self.assertIn(fragment, output["permissionDecisionReason"])

    def assert_allowed(self, result) -> None:
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "")

    def test_denies_build_output_by_absolute_path(self) -> None:
        result = run_hook(SCRIPT, self.root, self.edit(str(self.root / "app/build/generated/X.kt")))
        self.assert_denied(result, "app/build/generated/X.kt", "build output")

    def test_denies_room_schema_by_relative_path(self) -> None:
        result = run_hook(SCRIPT, self.root, self.edit("app/schemas/com.acme.AppDatabase/1.json"))
        self.assert_denied(result, "app/schemas/com.acme.AppDatabase/1.json", "Room")

    def test_denies_gradle_and_kotlin_caches_and_wrapper_jar(self) -> None:
        for path in (".gradle/8.0/x.bin", ".kotlin/sessions/a", "gradle/wrapper/gradle-wrapper.jar"):
            with self.subTest(path=path):
                self.assert_denied(run_hook(SCRIPT, self.root, self.edit(path)), path)

    def test_allows_source_file(self) -> None:
        result = run_hook(SCRIPT, self.root, self.edit("app/src/main/kotlin/com/acme/Foo.kt"))
        self.assert_allowed(result)

    def test_allows_source_package_named_build(self) -> None:
        result = run_hook(SCRIPT, self.root, self.edit("app/src/main/kotlin/com/acme/build/Foo.kt"))
        self.assert_allowed(result)

    def test_allows_path_outside_project(self) -> None:
        result = run_hook(SCRIPT, self.root, self.edit("/tmp/elsewhere/build/Foo.kt"))
        self.assert_allowed(result)

    def test_denies_apply_patch_with_mixed_files(self) -> None:
        patch = (
            "*** Begin Patch\n"
            "*** Update File: app/src/main/kotlin/com/acme/Foo.kt\n@@\n-a\n+b\n"
            "*** Update File: app/build/tmp/Gen.kt\n@@\n-a\n+b\n"
            "*** End Patch\n"
        )
        payload = {"hook_event_name": "PreToolUse", "tool_name": "apply_patch", "cwd": str(self.root),
                   "tool_input": {"command": patch}}
        result = run_hook(SCRIPT, self.root, payload)
        self.assert_denied(result, "app/build/tmp/Gen.kt")
        self.assertNotIn("Foo.kt is generated", result.stdout)

    def test_empty_or_invalid_stdin_is_ignored(self) -> None:
        for raw in ("", "not json", "[1, 2]"):
            with self.subTest(raw=raw):
                self.assert_allowed(run_hook(SCRIPT, self.root, raw=raw))


if __name__ == "__main__":
    unittest.main()
