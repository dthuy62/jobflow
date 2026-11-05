from __future__ import annotations

import json
import re
import unittest

from ._support import REPO_ROOT

SCRIPT_REF = re.compile(r"tools/agents/hooks/([a-z_]+\.py)")


def load(rel: str) -> dict:
    return json.loads((REPO_ROOT / rel).read_text())


def commands(config: dict, event: str) -> list[tuple[str, str]]:
    return [(group["matcher"], hook["command"]) for group in config["hooks"][event] for hook in group["hooks"]]


class HookConfigTest(unittest.TestCase):
    def assert_wired(self, config: dict, matcher: str) -> None:
        expected = {"PreToolUse": "guard_generated.py", "PostToolUse": "file_length.py"}
        for event, script in expected.items():
            with self.subTest(event=event):
                entries = commands(config, event)
                self.assertTrue(entries, f"no {event} hooks")
                for group_matcher, command in entries:
                    self.assertEqual(group_matcher, matcher)
                    self.assertEqual(SCRIPT_REF.findall(command), [script])
                    self.assertTrue((REPO_ROOT / "tools/agents/hooks" / script).is_file())

    def test_claude_settings_keep_plugin_and_add_hooks(self) -> None:
        settings = load(".claude/settings.json")
        self.assertIn("mobile-app-config", settings["extraKnownMarketplaces"])
        self.assertTrue(settings["enabledPlugins"]["mobile-app-config@mobile-app-config"])
        self.assert_wired(settings, "Write|Edit|MultiEdit")
        for _, command in commands(settings, "PreToolUse") + commands(settings, "PostToolUse"):
            self.assertIn('"${CLAUDE_PROJECT_DIR}/tools/agents/hooks/', command)

    def test_codex_hooks(self) -> None:
        self.assert_wired(load(".codex/hooks.json"), "apply_patch|Edit|Write")


if __name__ == "__main__":
    unittest.main()
