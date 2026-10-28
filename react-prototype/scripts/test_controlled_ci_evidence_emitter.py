"""CI-only smoke for the complete FD evidence producer, run before Playwright.

Only files invented in an exclusive disposable test folder are accessed.
The subprocess receives no paths to game folders, user files, or mods.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import unittest

SCRIPT = str(Path(__file__).with_name("emit_controlled_ci_fd_evidence.py"))

@unittest.skipUnless(
    sys.platform.startswith("linux") and os.environ.get("GITHUB_ACTIONS") == "true",
    "Only Linux GitHub CI may execute this disposable ZIP FD integration test",
)
class ControlledCiEvidenceEmitterTests(unittest.TestCase):
    def test_disposable_fd_producer_exposes_only_counted_evidence(self):
        result = subprocess.run(
            [sys.executable, "-I", "-S", "-B", SCRIPT],
            cwd="/",
            env={"PYTHONIOENCODING": "utf-8", "CI": "true",
                 "GITHUB_ACTIONS": "true"},
            capture_output=True, text=True, timeout=20, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr[:120])
        self.assertEqual(result.stderr, "")
        self.assertLess(len(result.stdout), 30000)
        report = json.loads(result.stdout)
        self.assertEqual(report["inputCount"], 3)
        self.assertEqual(report["report"]["fixtureCount"], 3)
        self.assertEqual(report["report"]["declaredHintCount"], 3)
        first = report["report"]["slots"][0]["hints"]
        self.assertEqual(first["model"]["ambiguousAcrossFixtures"], 1)
        self.assertEqual(first["mesh"]["candidateInOtherFixture"], 1)
        self.assertEqual(first["texture"]["notFoundInProvidedFixtures"], 1)
        for field in ("osSandboxVerified", "fdOriginAuthenticated",
                      "realUserModsInspected", "gameCompatibilityVerified",
                      "installationEnabled", "writesPerformed"):
            self.assertIs(report[field], False)
        for name in ("Vehicles/", "sample.bus", "missing.dds",
                     "ci-fd-evidence-", "not actual game geometry"):
            self.assertNotIn(name, result.stdout)


if __name__ == "__main__":
    unittest.main()
