from __future__ import annotations

import re
import unittest

from ._support import REPO_ROOT

DECISIONS = REPO_ROOT / "docs" / "decisions"
FILE_NAME = re.compile(r"^\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$")
STATUS = re.compile(r"^Status: (Proposed|Accepted|Rejected|Deprecated|Superseded by \d{4})( \(\d{4}-\d{2}-\d{2}\))?$", re.M)


class DecisionsTest(unittest.TestCase):
    def test_adrs_follow_the_format(self) -> None:
        files = sorted(DECISIONS.glob("*.md"))
        self.assertGreaterEqual(len(files), 4)
        numbers = []
        for adr in files:
            with self.subTest(adr=adr.name):
                self.assertRegex(adr.name, FILE_NAME)
                text = adr.read_text()
                self.assertTrue(text.startswith(f"# {int(adr.name[:4])}. "))
                self.assertRegex(text, STATUS)
                for section in ("## Context", "## Decision", "## Consequences"):
                    self.assertIn(section, text)
                numbers.append(int(adr.name[:4]))
        self.assertEqual(numbers, list(range(1, len(numbers) + 1)))

    def test_guides_link_to_decisions(self) -> None:
        links: set[str] = set()
        for guide in DECISIONS.parent.glob("*.md"):
            links.update(re.findall(r"\]\((decisions/[^)#]+)\)", guide.read_text()))
        self.assertGreaterEqual(len(links), 3)
        for link in sorted(links):
            with self.subTest(link=link):
                self.assertTrue((DECISIONS.parent / link).is_file())


if __name__ == "__main__":
    unittest.main()
