from __future__ import annotations

import re
import unittest

from ._support import REPO_ROOT

SKILLS = REPO_ROOT / ".claude" / "skills"
RULES = REPO_ROOT / ".claude" / "rules"
LINK = re.compile(r"`(references/[^`]+\.md)`")


def frontmatter(text: str) -> dict[str, list[str]]:
    """Top-level keys of a '---' delimited header, each mapped to its value lines."""
    if not text.startswith("---\n"):
        return {}
    header = text[4:text.index("\n---\n", 4)]
    keys: dict[str, list[str]] = {}
    current = None
    for line in header.splitlines():
        if line and not line.startswith((" ", "-")) and ":" in line:
            current, value = line.split(":", 1)
            keys[current] = [value.strip()] if value.strip() else []
        elif current is not None and line.strip():
            keys[current].append(line.strip())
    return keys


class SkillsTest(unittest.TestCase):
    def test_every_skill_has_name_and_description_only(self) -> None:
        skill_dirs = [path for path in SKILLS.iterdir() if path.is_dir()]
        self.assertTrue(skill_dirs)
        for skill in skill_dirs:
            with self.subTest(skill=skill.name):
                meta = frontmatter((skill / "SKILL.md").read_text())
                self.assertEqual(sorted(meta), ["description", "name"])
                self.assertEqual(meta["name"], [skill.name])
                self.assertEqual(len(meta["description"]), 1)
                self.assertGreater(len(meta["description"][0]), 40)

    def test_reference_links_resolve(self) -> None:
        for skill_md in SKILLS.glob("*/SKILL.md"):
            for ref in LINK.findall(skill_md.read_text()):
                with self.subTest(skill=skill_md.parent.name, ref=ref):
                    self.assertTrue((skill_md.parent / ref).is_file())


class RulesTest(unittest.TestCase):
    def test_rules_are_path_scoped_and_short(self) -> None:
        rules = sorted(RULES.glob("*.md"))
        self.assertEqual([rule.name for rule in rules], ["compose-ui.md", "testing.md"])
        for rule in rules:
            with self.subTest(rule=rule.name):
                text = rule.read_text()
                meta = frontmatter(text)
                self.assertEqual(list(meta), ["paths"])
                self.assertTrue(meta["paths"] and all(item.startswith('- "') for item in meta["paths"]))
                self.assertLess(len(text.splitlines()), 40)


if __name__ == "__main__":
    unittest.main()
