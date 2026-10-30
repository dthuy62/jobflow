from __future__ import annotations

import re
import unittest

from ._support import REPO_ROOT

TABLE_ROW = re.compile(r"^\|(?P<task>[^|]+)\|(?P<target>[^|]+)\|$")
SKILL_REF = re.compile(r"skill `([a-z0-9-]+)`")
PATH_REF = re.compile(r"`([.\w/-]+(?:\.md|/))`")


class AgentEntryPointsTest(unittest.TestCase):
    def test_agents_md_is_short(self) -> None:
        lines = (REPO_ROOT / "AGENTS.md").read_text().splitlines()
        self.assertLessEqual(len(lines), 60)

    def test_pointers_resolve(self) -> None:
        text = (REPO_ROOT / "AGENTS.md").read_text()
        table = text.split("## When you need more", 1)[1]
        rows = [m for line in table.splitlines() if (m := TABLE_ROW.match(line.strip()))]
        targets = [m["target"] for m in rows if not set(m["target"].strip()) <= set("-: ")][1:]
        self.assertGreaterEqual(len(targets), 6)
        for target in targets:
            for skill in SKILL_REF.findall(target):
                with self.subTest(skill=skill):
                    self.assertTrue((REPO_ROOT / ".claude/skills" / skill / "SKILL.md").is_file())
            for path in PATH_REF.findall(target):
                with self.subTest(path=path):
                    self.assertTrue((REPO_ROOT / path).exists())

    def test_claude_md_imports_agents_md(self) -> None:
        claude = REPO_ROOT / "CLAUDE.md"
        self.assertFalse(claude.is_symlink())
        first = next(line for line in claude.read_text().splitlines() if line.strip())
        self.assertEqual(first.strip(), "@AGENTS.md")

    def test_skill_folders_are_shared_through_symlinks(self) -> None:
        target = (REPO_ROOT / ".claude/skills").resolve()
        for link in (".agents/skills", ".opencode/skills"):
            with self.subTest(link=link):
                path = REPO_ROOT / link
                self.assertTrue(path.is_symlink())
                self.assertEqual(path.resolve(), target)

    def test_cursor_rule_points_to_agents_md(self) -> None:
        text = (REPO_ROOT / ".cursor/rules/android.mdc").read_text()
        self.assertIn("alwaysApply: true", text)
        self.assertIn("AGENTS.md", text)


if __name__ == "__main__":
    unittest.main()
