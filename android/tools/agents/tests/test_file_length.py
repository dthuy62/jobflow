from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from ._support import run_hook

SCRIPT = "file_length.py"


class FileLengthTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name).resolve()

    def tearDown(self) -> None:
        self._tmp.cleanup()

    def write(self, rel: str, lines: int) -> Path:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("".join(f"// line {n}\n" for n in range(lines)))
        return path

    def run_for(self, rel: str):
        payload = {"hook_event_name": "PostToolUse", "tool_name": "Write", "cwd": str(self.root),
                   "tool_input": {"file_path": rel}}
        return run_hook(SCRIPT, self.root, payload)

    def test_warns_for_kotlin_file_over_limit(self) -> None:
        self.write("app/src/main/kotlin/com/acme/Big.kt", 401)
        result = self.run_for("app/src/main/kotlin/com/acme/Big.kt")
        self.assertEqual(result.returncode, 0, result.stderr)
        output = json.loads(result.stdout)["hookSpecificOutput"]
        self.assertEqual(output["hookEventName"], "PostToolUse")
        self.assertIn("app/src/main/kotlin/com/acme/Big.kt has 401 lines", output["additionalContext"])
        self.assertIn("limit 400", output["additionalContext"])

    def test_warns_for_kts_file_over_limit(self) -> None:
        self.write("app/build.gradle.kts", 450)
        self.assertIn("450 lines", self.run_for("app/build.gradle.kts").stdout)

    def test_silent_at_limit(self) -> None:
        self.write("app/src/main/kotlin/com/acme/Ok.kt", 400)
        self.assertEqual(self.run_for("app/src/main/kotlin/com/acme/Ok.kt").stdout.strip(), "")

    def test_silent_for_non_kotlin_file(self) -> None:
        self.write("README.md", 900)
        self.assertEqual(self.run_for("README.md").stdout.strip(), "")

    def test_silent_for_generated_file(self) -> None:
        self.write("app/build/generated/Big.kt", 900)
        self.assertEqual(self.run_for("app/build/generated/Big.kt").stdout.strip(), "")

    def test_silent_for_missing_file_and_outside_project(self) -> None:
        self.assertEqual(self.run_for("app/src/main/kotlin/Missing.kt").stdout.strip(), "")
        self.assertEqual(self.run_for("/tmp/elsewhere/Big.kt").stdout.strip(), "")

    def test_empty_or_invalid_stdin_is_ignored(self) -> None:
        for raw in ("", "{", "42"):
            with self.subTest(raw=raw):
                result = run_hook(SCRIPT, self.root, raw=raw)
                self.assertEqual((result.returncode, result.stdout.strip()), (0, ""))


if __name__ == "__main__":
    unittest.main()
