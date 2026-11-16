"""M25: adversarial no-filter PR trigger and mandatory X11 contracts."""
import json
from pathlib import Path
import unittest

from controlled_ci_event_coverage import (
    CRITICAL, PR_ONLY, evaluate_unfiltered_pr_coverage,
    inspect_checked_out_workflow,
)

FILE = Path(__file__).resolve().parents[2] / ".github/workflows/react-prototype.yml"
SOURCE = FILE.read_text("utf-8")


def accepts(workflow):
    return evaluate_unfiltered_pr_coverage(workflow)


class UnfilteredPrCoverageTests(unittest.TestCase):
    def test_actual_candidate_workflow_has_no_pr_file_or_branch_filters(self):
        report = inspect_checked_out_workflow()
        self.assertEqual(report["criticalJobDefinitions"], len(CRITICAL))
        self.assertEqual(report["prOnlyInformationalJobDefinitions"],
                         len(PR_ONLY))
        self.assertTrue(report["pullRequestUnfilteredByPaths"])
        self.assertTrue(report["pullRequestUnfilteredByBaseBranch"])
        self.assertTrue(report["pushToMainDeclared"])
        self.assertTrue(report["strictUbuntu24And22MatrixRetained"])
        self.assertTrue(report["strictNativeX11FailureMandatory"])
        self.assertEqual(report["requiredCheckContextsSelected"], [])
        for field in ("actualDocsOnlyPullRequestExecutionVerified",
                      "workflowExistsOnMainVerified",
                      "exactRequiredCheckContextsVerified",
                      "branchProtectionChanged", "ubuntu24StrictSandboxWaived",
                      "mergeAuthorized", "installationAuthorized"):
            self.assertFalse(report[field])

    def test_docs_only_synthetic_trigger_is_no_longer_path_filtered(self):
        # YAML event shape only; NOT a fabricated real docs-only Actions run.
        self.assertIn("\n  pull_request:\nconcurrency:", SOURCE)
        self.assertNotIn("    paths:", SOURCE.split("\njobs:\n")[0])
        self.assertNotIn("    paths-ignore:", SOURCE.split("\njobs:\n")[0])
        self.assertTrue(accepts(SOURCE)["pullRequestUnfilteredByPaths"])

    def test_reject_all_attempts_to_narrow_pr_coverage(self):
        original = "  pull_request:\n"
        cases = (
            "  pull_request:\n    paths:\n      - 'react-prototype/**'\n",
            "  pull_request:\n    paths-ignore:\n      - 'docs/**'\n",
            "  pull_request:\n    branches: [main]\n",
            "  pull_request:\n    branches-ignore: [main]\n",
            "  pull_request:\n    types: [opened]\n",
            "  pull_request:\n    paths:\n      - '.github/**'\n",
            "  pull_request_target:\n",
        )
        for replacement in cases:
            with self.subTest(event=replacement.strip()[:30]):
                self.assertRaisesRegex(
                    ValueError, "^CONTROLLED_PR_COVERAGE_REFUSED$",
                    accepts, SOURCE.replace(original, replacement, 1))

    def test_reject_missing_main_push_or_unrelated_branch(self):
        for replacement in (
            "    branches: [feat/react-nine-screens-safe]",
            "    branches: [main]",
            "    branches: [release, main]",
            "    branches-ignore: [main]",
        ):
            with self.subTest(push=replacement):
                self.assertRaisesRegex(
                    ValueError, "^CONTROLLED_PR_COVERAGE_REFUSED$",
                    accepts, SOURCE.replace(
                        "    branches: [feat/react-nine-screens-safe, main]",
                        replacement, 1))

    def test_native_x11_matrix_and_failfast_are_still_mandatory(self):
        for first, second in (
            ("runner: [ubuntu-24.04, ubuntu-22.04]",
             "runner: [ubuntu-22.04]"),
            ("fail-fast: false", "fail-fast: true"),
            ("runs-on: ${{ matrix.runner }}", "runs-on: ubuntu-22.04"),
        ):
            with self.subTest(change=first):
                self.assertRaisesRegex(
                    ValueError, "^CONTROLLED_PR_COVERAGE_REFUSED$",
                    accepts, SOURCE.replace(first, second, 1))

    def test_reject_conditional_skipping_or_continue_on_error_for_critical_jobs(self):
        for key in ("build", "native_auto_x11", "windows_portable",
                    "synthetic_two_revision_contract"):
            with self.subTest(job=key):
                modified = SOURCE.replace(
                    "  " + key + ":\n",
                    "  " + key + ":\n    if: github.event_name == 'push'\n", 1)
                self.assertRaisesRegex(
                    ValueError, "^CONTROLLED_PR_COVERAGE_REFUSED$",
                    accepts, modified)
        modified = SOURCE.replace(
            "  native_auto_x11:\n",
            "  native_auto_x11:\n    continue-on-error: true\n", 1)
        self.assertRaisesRegex(
            ValueError, "^CONTROLLED_PR_COVERAGE_REFUSED$",
            accepts, modified)

    def test_evidence_compare_must_remain_diagnostic_not_ubuntu_24_waiver(self):
        changes = (
            ("    needs: [build, native_auto_x11]",
             "    needs: [build]"),
            ("    if: ${{ always() }}", "    if: ${{ success() }}"),
            ("  native_x11_evidence_compare:",
             "  native_x11_evidence_compare:\n    continue-on-error: true"),
        )
        for first, second in changes:
            with self.subTest(removed=first):
                self.assertRaisesRegex(
                    ValueError, "^CONTROLLED_PR_COVERAGE_REFUSED$",
                    accepts, SOURCE.replace(first, second, 1))

    def test_no_missing_or_duplicate_critical_job_definition(self):
        self.assertRaisesRegex(
            ValueError, "^CONTROLLED_PR_COVERAGE_REFUSED$",
            accepts, SOURCE.replace("  windows_portable:", "  windows_portable_missing:", 1))
        self.assertRaisesRegex(
            ValueError, "^CONTROLLED_PR_COVERAGE_REFUSED$",
            accepts, SOURCE.replace(
                "  windows_portable:",
                "  windows_portable:\n    runs-on: windows-latest\n"
                "  windows_portable:", 1))

    def test_invalid_source_and_private_data_do_not_leak(self):
        for source in (None, 34, "", SOURCE + "\r", SOURCE * 20):
            with self.subTest(source_type=type(source).__name__):
                self.assertRaisesRegex(
                    ValueError, "^CONTROLLED_PR_COVERAGE_REFUSED$",
                    accepts, source)
        serialized = json.dumps(accepts(SOURCE))
        for forbidden in ("Vehicles/", "secret.o3d", "ghp_", "CODEOWNER",
                          "reviewerLogin", "githubToken"):
            self.assertNotIn(forbidden, serialized)


if __name__ == "__main__":
    unittest.main()
