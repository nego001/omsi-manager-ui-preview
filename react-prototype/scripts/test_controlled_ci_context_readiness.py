"""M24 no-network regression and adversarial contracts for CI contexts."""
import json
import unittest
from unittest.mock import patch
from controlled_ci_context_readiness import (
    REFERENCE_RUN_ID, REFERENCE_HEAD, R24, R22, MAX_JOBS,
    catalog_from_workflow, evaluate_ci_context_readiness,
    query_live_context_readiness,
)

REPO = "test-owner/synthetic-repository"
HEAD = "c" * 40
BASE_SHA = "d" * 40
RUN_ID = 12345678
TOKEN = "FAKE_CI_READ_ONLY_TOKEN_1234567890"
SOURCE = """name: React Prototype Validation
on:
  push:
    branches: [feat/react-nine-screens-safe]
  pull_request:
    paths:
      - 'react-prototype/**'
      - '.github/workflows/react-prototype.yml'
jobs:
  build:
    runs-on: ubuntu-22.04
  native_auto_x11:
    name: Native Auto X11 real-window check (${{ matrix.runner }}, strict sandbox)
    needs: build
    strategy:
      matrix:
        runner: [ubuntu-24.04, ubuntu-22.04]
    runs-on: ${{ matrix.runner }}
  native_x11_evidence_compare:
    name: Compare sanitized X11 host evidence (no sandbox changes)
    needs: [build, native_auto_x11]
    if: ${{ always() }}
  synthetic_two_revision_contract:
    name: Synthetic fixture two-revision comparison (CI only)
    runs-on: ubuntu-22.04
"""


def repo_meta():
    return {"full_name": REPO, "default_branch": "main"}


def branch():
    return {"name": "main", "commit": {"sha": BASE_SHA}}


def main_workflow():
    return {"type": "file", "name": "react-prototype.yml", "sha": "a" * 40}


def run(current=False):
    return {
        "id": RUN_ID if current else REFERENCE_RUN_ID,
        "head_sha": HEAD if current else REFERENCE_HEAD,
        "event": "pull_request", "repository": {"full_name": REPO},
        "status": "in_progress" if current else "completed",
        "conclusion": None if current else "failure",
    }


def job(name, key, conclusion="success", status="completed"):
    return {"name": name, "id": key, "status": status,
            "conclusion": conclusion}


def jobs(current=False):
    entries = [
        job("build", 1),
        job(R24, 2, None if current else "failure",
            "in_progress" if current else "completed"),
        job(R22, 3),
        job("Compare sanitized X11 host evidence (no sandbox changes)", 4),
    ]
    if current:
        entries = entries[:2]
    return {"total_count": len(entries), "jobs": entries}


def assess(source=SOURCE, file=None, reference=None, previous=None,
           current=None, current_jobs=None):
    return evaluate_ci_context_readiness(
        source, repo_meta(), branch(), file,
        run() if reference is None else reference,
        jobs() if previous is None else previous,
        run(True) if current is None else current,
        jobs(True) if current_jobs is None else current_jobs,
        REPO, RUN_ID, HEAD,
    )


class ReadOnlyCiContextTests(unittest.TestCase):
    def assert_blocked(self, result):
        self.assertEqual(result["requiredCheckContextsSelected"], [])
        for key in ("exactRequiredCheckContextsVerified",
                    "defaultBranchWorkflowExecutedVerified",
                    "safeToEnforceRequiredChecks", "branchRulesChanged",
                    "ubuntu24SandboxWaived", "mergeAuthorized",
                    "installationAuthorized"):
            self.assertIs(result[key], False)

    def test_synthetic_workflow_matrix_labels_and_dependencies(self):
        c = catalog_from_workflow(SOURCE, "main")
        self.assertEqual(c["declaredJobs"], 4)
        self.assertEqual(len(c["expandedNames"]), 5)
        self.assertIn(R24, c["expandedNames"])
        self.assertIn(R22, c["expandedNames"])
        self.assertEqual(c["jobsWithDependencies"], 2)
        self.assertTrue(c["pullRequestPathFiltered"])
        self.assertFalse(c["defaultBranchPushCovered"])

    def test_missing_main_workflow_blocks_required_checks(self):
        r = assess()
        self.assertEqual(r["auditStatus"], "defaultBranchWorkflowMissing")
        self.assertEqual(r["candidateExpandedJobNames"], 5)
        self.assertEqual(r["missingCandidateNamesInPreviousRun"], 1)
        self.assertTrue(r["previousUbuntu24StrictFailure"])
        self.assertTrue(r["previousUbuntu22StrictSuccess"])
        self.assertTrue(r["candidatePullRequestPathFilterPresent"])
        self.assertFalse(r["candidatePushCoversDefaultBranch"])
        self.assertFalse(r["workflowPresentOnDefaultBranch"])
        self.assert_blocked(r)

    def test_main_workflow_presence_does_not_erase_ubuntu_failure(self):
        r = assess(file=main_workflow())
        self.assertEqual(r["auditStatus"], "ubuntu24ReferenceFailureBlocks")
        self.assertTrue(r["workflowPresentOnDefaultBranch"])
        self.assert_blocked(r)

    def test_green_ubuntu24_still_does_not_fix_path_filters(self):
        previous = jobs()
        previous["jobs"][1] = job(R24, 2, "success")
        r = assess(file=main_workflow(), previous=previous)
        self.assertEqual(r["auditStatus"], "pathFilteredChecksCanRemainPending")
        self.assert_blocked(r)

    def test_removed_path_filter_but_no_main_push_remains_blocked(self):
        src = SOURCE.replace(
            "    paths:\n      - 'react-prototype/**'\n"
            "      - '.github/workflows/react-prototype.yml'\n", "")
        previous = jobs()
        previous["jobs"][1] = job(R24, 2)
        r = assess(source=src, file=main_workflow(), previous=previous)
        self.assertEqual(r["auditStatus"], "noDefaultBranchPushCoverage")
        self.assert_blocked(r)

    def test_all_known_obstacles_gone_still_requires_manual_verification(self):
        src = SOURCE.replace("branches: [feat/react-nine-screens-safe]",
                             "branches: [main]").replace(
            "    paths:\n      - 'react-prototype/**'\n"
            "      - '.github/workflows/react-prototype.yml'\n", "")
        previous = jobs()
        previous["jobs"][1] = job(R24, 2)
        r = assess(source=src, file=main_workflow(), previous=previous)
        self.assertEqual(r["auditStatus"],
                         "manualRequiredContextConfirmationNeeded")
        self.assert_blocked(r)

    def test_missing_matrix_unknown_dependency_or_duplicate_job_refused(self):
        invalid = (
            SOURCE.replace("ubuntu-24.04, ubuntu-22.04", "ubuntu-22.04"),
            SOURCE.replace("    needs: build", "    needs: missing_job"),
            SOURCE.replace("    needs: [build, native_auto_x11]", "    needs: build"),
            SOURCE.replace("  native_auto_x11:", "  renamed_x11:"),
            SOURCE.replace("jobs:\n", "not_jobs:\n"),
            SOURCE.replace("  native_auto_x11:",
                           "  native_auto_x11:\n    name: Another title"),
        )
        for item in invalid:
            with self.subTest(size=len(item)):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_CI_CONTEXT_AUDIT_REFUSED$"):
                    catalog_from_workflow(item, "main")

    def test_wrong_run_sha_state_repo_or_event_refused(self):
        malformed = (
            {**run(), "head_sha": HEAD},
            {**run(), "event": "push"},
            {**run(), "status": "completed", "conclusion": None},
            {**run(), "repository": {"full_name": "another/repo"}},
            {**run(), "id": True},
        )
        for item in malformed:
            with self.subTest(value=item["event"]):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_CI_CONTEXT_AUDIT_REFUSED$"):
                    assess(reference=item)

    def test_partial_current_run_never_masquerades_as_success(self):
        r = assess()
        self.assertEqual(r["currentJobCountAtObservation"], 2)
        self.assertEqual(r["currentCompletedJobCountAtObservation"], 1)
        self.assert_blocked(r)

    def test_bad_counts_duplicate_names_and_incomplete_reference_refused(self):
        invalid = (
            {"total_count": 3, "jobs": jobs()["jobs"]},
            {"total_count": True, "jobs": []},
            {"total_count": MAX_JOBS + 1, "jobs": []},
            {"total_count": 2, "jobs": [job("build", 1), job("build", 2)]},
            {"total_count": 1, "jobs": [job("private/path.o3d", 1)]},
            {"total_count": 1, "jobs": [job("build", 1, None)]},
        )
        for entry in invalid:
            with self.subTest(count=entry["total_count"]):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_CI_CONTEXT_AUDIT_REFUSED$"):
                    assess(previous=entry)

    def test_live_queries_are_read_only_and_main_sha_pinned(self):
        queries = []
        def fake_api(token, path, allow_missing=False):
            self.assertEqual(token, TOKEN)
            queries.append((path, allow_missing))
            if path == "repos/" + REPO:
                return repo_meta()
            if path.endswith("/branches/main"):
                return branch()
            if "/contents/.github/workflows/" in path:
                return None
            if path.endswith("/actions/runs/" + str(REFERENCE_RUN_ID)):
                return run()
            if "/actions/runs/" + str(REFERENCE_RUN_ID) + "/jobs?" in path:
                return jobs()
            if path.endswith("/actions/runs/" + str(RUN_ID)):
                return run(True)
            if "/actions/runs/" + str(RUN_ID) + "/jobs?" in path:
                return jobs(True)
            raise AssertionError("unsupported API path")
        with patch("controlled_ci_context_readiness._api_json",
                   side_effect=fake_api):
            result = query_live_context_readiness(
                REPO, RUN_ID, HEAD, TOKEN, SOURCE)
        self.assertEqual(len(queries), 7)
        self.assertTrue(any("?ref=" + BASE_SHA in p and missing
                            for p, missing in queries))
        self.assertEqual(result["auditStatus"], "defaultBranchWorkflowMissing")
        self.assert_blocked(result)

    def test_invalid_repo_token_sha_or_run_id_refuse_without_network(self):
        for args in (
            ("../secret", RUN_ID, HEAD, TOKEN),
            (REPO, True, HEAD, TOKEN),
            (REPO, RUN_ID, "bad-sha", TOKEN),
            (REPO, RUN_ID, HEAD, "short"),
        ):
            with self.subTest(case=args[:2]):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_CI_CONTEXT_AUDIT_REFUSED$"):
                    query_live_context_readiness(*args, SOURCE)

    def test_public_output_never_contains_token_or_private_file(self):
        published = json.dumps(assess())
        for secret in ("test-owner", HEAD, BASE_SHA, "private/file.o3d",
                       "FAKE_CI_READ_ONLY_TOKEN", "realModValidated:true"):
            self.assertNotIn(secret, published)
        self.assert_blocked(assess())


if __name__ == "__main__":
    unittest.main()
