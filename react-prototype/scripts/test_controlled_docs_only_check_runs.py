"""M26: adversarial contracts for REAL docs-only GitHub check-run evidence.

Every test uses fabricated API responses; the CI job separately performs
a read-only query of the actual PR #30 and its GitHub Actions run.
"""
from __future__ import annotations

import json
from pathlib import Path
import unittest
from unittest.mock import patch

from controlled_docs_only_check_runs import (
    DOCS_PROBE_BASE, DOCS_PROBE_BASE_BRANCH, DOCS_PROBE_BRANCH,
    DOCS_PROBE_FILE, DOCS_PROBE_HEAD, DOCS_PROBE_PR,
    DOCS_PROBE_RUN_ID, REPOSITORY, SCHEMA, STRICT_X11_24_NAME,
    observe_docs_only_check_runs, query_real_docs_only_probe,
)

SOURCE = (Path(__file__).resolve().parents[2] /
          ".github/workflows/react-prototype.yml").read_text("utf-8")
FAKE_TOKEN = "FIXTURE_TOKEN_ONLY_READ_ONLY_1234567890"


def fake_pr():
    return {
        "number": DOCS_PROBE_PR, "draft": True, "state": "open",
        "head": {"sha": DOCS_PROBE_HEAD, "ref": DOCS_PROBE_BRANCH},
        "base": {"sha": DOCS_PROBE_BASE, "ref": DOCS_PROBE_BASE_BRANCH,
                 "repo": {"full_name": REPOSITORY}},
    }


def fake_files():
    return [{"filename": DOCS_PROBE_FILE, "status": "added", "changes": 25}]


def fake_run():
    return {
        "id": DOCS_PROBE_RUN_ID, "name": "React Prototype Validation",
        "event": "pull_request", "head_sha": DOCS_PROBE_HEAD,
        "head_branch": DOCS_PROBE_BRANCH,
        "repository": {"full_name": REPOSITORY},
        "pull_requests": [{"number": DOCS_PROBE_PR}],
        "status": "in_progress", "conclusion": None,
    }


def fake_job(name, number, status="completed", conclusion="success"):
    return {"id": number, "name": name, "status": status,
            "conclusion": conclusion}


def fake_check(job):
    return {
        "id": job["id"], "name": job["name"], "head_sha": DOCS_PROBE_HEAD,
        "status": job["status"], "conclusion": job["conclusion"],
        "app": {"slug": "github-actions"},
        "details_url": (f"https://github.com/{REPOSITORY}/actions/runs/"
                        f"{DOCS_PROBE_RUN_ID}/job/{job['id']}"),
    }


def sample():
    jobs = [
        fake_job("build", 100),
        fake_job("Synthetic fixture two-revision comparison (CI only)", 101),
        fake_job(STRICT_X11_24_NAME, 102, "in_progress", None),
    ]
    return (
        fake_pr(), fake_files(), fake_run(),
        {"total_count": len(jobs), "jobs": jobs},
        {"total_count": len(jobs), "check_runs": [fake_check(j) for j in jobs]},
    )


def audit(parts):
    return observe_docs_only_check_runs(*parts, SOURCE)


class DocsOnlyRealCheckRunContracts(unittest.TestCase):
    def test_proves_docs_only_trigger_with_real_check_ids_but_no_approval(self):
        result = audit(sample())
        self.assertEqual(result["schema"], SCHEMA)
        self.assertTrue(result["docsOnlyPullRequest"])
        self.assertEqual(result["changedFileCount"], 1)
        self.assertTrue(result["pullRequestEventRunVerified"])
        self.assertEqual(result["runId"], DOCS_PROBE_RUN_ID)
        self.assertEqual(result["observedRealCheckRunCount"], 3)
        self.assertTrue(result["strictUbuntu24CheckRunPresent"])
        self.assertIsNone(result["strictUbuntu24ConclusionAtObservation"])
        self.assertEqual(
            [entry["checkRunId"] for entry in result["observedCheckRuns"]],
            [100, 101, 102])
        self.assertEqual(
            {entry["sourceApp"] for entry in result["observedCheckRuns"]},
            {"github-actions"})
        self.assertEqual(result["requiredContextIDsSelected"], [])
        for key in ("allChecksCompletedVerified",
                    "mainBranchWorkflowInstalled",
                    "requiredStatusChecksConfigured",
                    "ubuntu24StrictSandboxWaived", "mergeAuthorized",
                    "realModValidated", "installationAuthorized"):
            self.assertFalse(result[key])

    def test_real_ubuntu24_failure_is_reported_not_suppressed(self):
        parts = list(sample())
        parts[3]["jobs"][-1]["status"] = "completed"
        parts[3]["jobs"][-1]["conclusion"] = "failure"
        parts[4]["check_runs"][-1]["status"] = "completed"
        parts[4]["check_runs"][-1]["conclusion"] = "failure"
        result = audit(tuple(parts))
        self.assertEqual(result["strictUbuntu24ConclusionAtObservation"],
                         "failure")
        self.assertFalse(result["ubuntu24StrictSandboxWaived"])
        self.assertFalse(result["mergeAuthorized"])

    def test_extra_file_or_non_docs_file_refuses_proof(self):
        for files in (
            fake_files() + [{"filename": "src/private.py", "status": "modified"}],
            [{"filename": ".github/workflows/react-prototype.yml",
              "status": "modified", "changes": 1}],
            [{"filename": DOCS_PROBE_FILE, "status": "removed", "changes": 25}],
        ):
            parts = list(sample())
            parts[1] = files
            with self.assertRaisesRegex(
                    ValueError,
                    "^CONTROLLED_DOCS_ONLY_CHECK_RUN_AUDIT_REFUSED$"):
                audit(tuple(parts))

    def test_wrong_head_base_draft_or_identity_refuses(self):
        variations = (
            {"draft": False},
            {"number": True},
            {"state": "closed"},
            {"head": {"sha": "a"*40, "ref": DOCS_PROBE_BRANCH}},
            {"base": {"sha": "f"*40, "ref": DOCS_PROBE_BASE_BRANCH,
                      "repo": {"full_name": REPOSITORY}}},
            {"base": {"sha": DOCS_PROBE_BASE, "ref": "main",
                      "repo": {"full_name": REPOSITORY}}},
        )
        for edit in variations:
            parts = list(sample())
            parts[0] = {**parts[0], **edit}
            with self.subTest(edit=next(iter(edit))):
                with self.assertRaisesRegex(
                        ValueError,
                        "^CONTROLLED_DOCS_ONLY_CHECK_RUN_AUDIT_REFUSED$"):
                    audit(tuple(parts))

    def test_non_pull_request_wrong_run_or_unlinked_pr_refuses(self):
        variations = (
            {"event": "push"},
            {"id": True},
            {"id": DOCS_PROBE_RUN_ID + 1},
            {"head_sha": "a"*40},
            {"pull_requests": []},
            {"name": "fake green build"},
            {"status": "fake completed"},
        )
        for edit in variations:
            parts = list(sample())
            parts[2] = {**parts[2], **edit}
            with self.subTest(edit=next(iter(edit))):
                with self.assertRaisesRegex(
                        ValueError,
                        "^CONTROLLED_DOCS_ONLY_CHECK_RUN_AUDIT_REFUSED$"):
                    audit(tuple(parts))

    def test_wrong_app_job_id_or_check_run_url_refuses(self):
        for kind in ("app", "id", "name", "head_sha", "details_url"):
            parts = list(sample())
            check = parts[4]["check_runs"][0]
            if kind == "app":
                check["app"] = {"slug": "untrusted-app"}
            elif kind == "id":
                check["id"] = 99
                check["details_url"] = (f"https://github.com/{REPOSITORY}"
                                        f"/actions/runs/{DOCS_PROBE_RUN_ID}/job/99")
            elif kind == "name":
                check["name"] = "fabricated success"
            elif kind == "head_sha":
                check["head_sha"] = "e"*40
            else:
                check["details_url"] = (f"https://github.com/{REPOSITORY}"
                                        f"/actions/runs/{DOCS_PROBE_RUN_ID}/job/999")
            with self.subTest(kind=kind):
                with self.assertRaisesRegex(
                        ValueError,
                        "^CONTROLLED_DOCS_ONLY_CHECK_RUN_AUDIT_REFUSED$"):
                    audit(tuple(parts))

    def test_foreign_run_check_is_excluded_not_promoted(self):
        parts = list(sample())
        foreign = dict(parts[4]["check_runs"][-1])
        foreign["details_url"] = "https://github.com/example/elsewhere"
        parts[4]["check_runs"][-1] = foreign
        result = audit(tuple(parts))
        self.assertEqual(result["excludedForeignRunChecks"], 1)
        self.assertEqual(result["observedRealCheckRunCount"], 2)
        self.assertFalse(result["strictUbuntu24CheckRunPresent"])

    def test_missing_minimum_build_or_comparison_does_not_prove_execution(self):
        for remove_id in (100, 101):
            parts = list(sample())
            filtered_jobs = [j for j in parts[3]["jobs"]
                             if j["id"] != remove_id]
            filtered_checks = [c for c in parts[4]["check_runs"]
                               if c["id"] != remove_id]
            parts[3] = {"total_count": len(filtered_jobs),
                        "jobs": filtered_jobs}
            parts[4] = {"total_count": len(filtered_checks),
                        "check_runs": filtered_checks}
            with self.subTest(id=remove_id):
                with self.assertRaisesRegex(
                        ValueError,
                        "^CONTROLLED_DOCS_ONLY_CHECK_RUN_AUDIT_REFUSED$"):
                    audit(tuple(parts))

    def test_repeated_check_name_or_fake_counts_refuses(self):
        parts = list(sample())
        parts[3]["jobs"][2]["name"] = "build"
        parts[4]["check_runs"][2]["name"] = "build"
        with self.assertRaisesRegex(
                ValueError,
                "^CONTROLLED_DOCS_ONLY_CHECK_RUN_AUDIT_REFUSED$"):
            audit(tuple(parts))
        parts = list(sample())
        parts[4]["total_count"] = True
        with self.assertRaisesRegex(
                ValueError,
                "^CONTROLLED_DOCS_ONLY_CHECK_RUN_AUDIT_REFUSED$"):
            audit(tuple(parts))

    def test_trigger_must_remain_unfiltered_in_candidate_workflow(self):
        filtered = SOURCE.replace(
            "  pull_request:\n",
            "  pull_request:\n    paths:\n      - 'react-prototype/**'\n", 1)
        with self.assertRaises(ValueError):
            observe_docs_only_check_runs(*sample(), filtered)

    def test_only_fixed_readonly_github_api_paths_are_invoked(self):
        paths = []
        parts = sample()
        def fake_api(token, path):
            self.assertEqual(token, FAKE_TOKEN)
            paths.append(path)
            if path.endswith("/pulls/30"):
                return parts[0]
            if "/pulls/30/files?" in path:
                return parts[1]
            if path.endswith("/actions/runs/" + str(DOCS_PROBE_RUN_ID)):
                return parts[2]
            if "/actions/runs/" in path and "/jobs?" in path:
                return parts[3]
            if "/check-runs?" in path:
                return parts[4]
            raise AssertionError("unexpected network endpoint")
        with patch("controlled_docs_only_check_runs._api_json",
                   side_effect=fake_api):
            result = query_real_docs_only_probe(FAKE_TOKEN, SOURCE)
        self.assertEqual(len(paths), 5)
        self.assertEqual(result["observedRealCheckRunCount"], 3)
        self.assertTrue(all(path.startswith("repos/" + REPOSITORY + "/")
                            for path in paths))

    def test_no_private_file_bytes_hashes_or_auth_token_in_result(self):
        report = audit(sample())
        serialized = json.dumps(report)
        for forbidden in (FAKE_TOKEN, DOCS_PROBE_HEAD,
                          "PRIVATE_MOD", "user@example.com", "readableZip",
                          "TOKEN_FOR_TESTS"):
            self.assertNotIn(forbidden, serialized)


if __name__ == "__main__":
    unittest.main()
