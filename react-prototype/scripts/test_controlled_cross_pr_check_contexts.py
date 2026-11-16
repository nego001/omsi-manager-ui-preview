"""M27 adversarial contracts; no GitHub network access in these tests."""
import json
import unittest
from unittest.mock import patch

from controlled_cross_pr_check_contexts import (
    APP, BASE_BRANCH, BASE_SHA, CODE_REQUIRED, CORE_NAMES,
    DOC_FILE, M26_ADDED, PROBES, REPOSITORY, SCHEMA, STRICT_24,
    compare_real_pr_contexts, query_cross_pr_contexts,
)

TOKEN = "FAKE_READ_ONLY_GITHUB_TOKEN_M27_12345"


def evidence(which, completed=False):
    spec = PROBES[which]
    pr = {"number": spec["number"], "state": "open", "draft": True,
          "head": {"sha": spec["head"], "ref": spec["branch"]},
          "base": {"sha": BASE_SHA, "ref": BASE_BRANCH,
                   "repo": {"full_name": REPOSITORY}}}
    files = (
        [{"filename": DOC_FILE, "status": "added", "changes": 25}]
        if which == 0 else
        [{"filename": f, "status": "added", "changes": 10}
         for f in sorted(CODE_REQUIRED)]
    )
    run = {"id": spec["run"], "name": "React Prototype Validation",
           "event": "pull_request", "head_sha": spec["head"],
           "head_branch": spec["branch"],
           "repository": {"full_name": REPOSITORY},
           "pull_requests": [{"number": spec["number"]}],
           "status": "completed" if completed else "in_progress",
           "conclusion": "failure" if completed else None}
    names = list(CORE_NAMES) if completed else [
        "build", "Synthetic fixture two-revision comparison (CI only)",
        "Windows portable preview (not signed)",
    ]
    if which == 1:
        names += [M26_ADDED]
    jobs = []
    checks = []
    for i, name in enumerate(names):
        ident = (1000 if which == 0 else 2000) + i
        state = "completed"
        conclusion = "failure" if name == STRICT_24 else "success"
        if not completed and name == "build":
            state, conclusion = "in_progress", None
        job = {"id": ident, "name": name,
               "status": state, "conclusion": conclusion}
        jobs.append(job)
        checks.append({
            "id": ident, "name": name, "status": state,
            "conclusion": conclusion, "head_sha": spec["head"],
            "app": {"slug": APP},
            "details_url": (
                f"https://github.com/{REPOSITORY}/actions/runs/"
                f"{spec['run']}/job/{ident}"),
        })
    return (pr, files, run,
            {"total_count": len(jobs), "jobs": jobs},
            {"total_count": len(checks), "check_runs": checks})


class CrossPrRealContextTests(unittest.TestCase):
    def assert_no_release(self, result):
        self.assertEqual(result["schema"], SCHEMA)
        self.assertEqual(result["requiredCheckContextsSelected"], [])
        for key in ("comparisonIsProofAllJobsPass",
                    "checkRunIdsAreStableAcrossRuns",
                    "requiredCheckContextsConfigured",
                    "mainBranchWorkflowInstalledVerified",
                    "ubuntu24StrictSandboxWaived",
                    "mergeAuthorized", "installationAuthorized"):
            self.assertFalse(result[key])

    def test_partially_running_code_pr_not_mistaken_for_missing_checks(self):
        left = evidence(0, completed=True)
        right = evidence(1, completed=False)
        result = compare_real_pr_contexts(left, right)
        self.assertEqual(result["comparisonStatus"], "codeRunStillInProgress")
        self.assertTrue(result["docsOnlyRunComplete"])
        self.assertFalse(result["codeRunComplete"])
        self.assertEqual(result["docsOnlyObservedCheckCount"], 13)
        self.assertEqual(result["codeObservedCheckCount"], 4)
        self.assertEqual(result["sharedNameAndAppCount"], 3)
        self.assertTrue(result["codeOnlyNewM26CheckObserved"])
        self.assertEqual(result["codePendingExpectedNames"], 10)
        self.assertTrue(result["docsOnlyUbuntu24StrictFailureObserved"])
        self.assertFalse(result["codeUbuntu24StrictFailureObserved"])
        self.assert_no_release(result)

    def test_completed_both_runs_find_thirteen_shared_context_names(self):
        result = compare_real_pr_contexts(
            evidence(0, completed=True), evidence(1, completed=True))
        self.assertEqual(
            result["comparisonStatus"], "completedSharedNamesAndAppObserved")
        self.assertEqual(result["sharedNameAndAppCount"], 13)
        self.assertEqual(result["docsOnlyPendingExpectedNames"], 0)
        self.assertEqual(result["codePendingExpectedNames"], 0)
        self.assertEqual(result["docsOnlyObservedCheckCount"], 13)
        self.assertEqual(result["codeObservedCheckCount"], 14)
        self.assertTrue(result["codeOnlyNewM26CheckObserved"])
        self.assertTrue(result["docsOnlyUbuntu24StrictFailureObserved"])
        self.assertTrue(result["codeUbuntu24StrictFailureObserved"])
        self.assertEqual(
            {entry["app"] for entry in result["sharedCheckNamesAndSourceApp"]},
            {"github-actions"})
        self.assert_no_release(result)

    def test_different_numeric_run_ids_not_treated_as_context_name_drift(self):
        result = compare_real_pr_contexts(evidence(0, True), evidence(1, True))
        self.assertEqual(result["sharedNameAndAppCount"], len(CORE_NAMES))
        self.assertFalse(result["checkRunIdsAreStableAcrossRuns"])

    def test_reusing_same_check_run_id_across_runs_is_refused(self):
        docs = evidence(0, True)
        code = list(evidence(1, True))
        code[3]["jobs"][0]["id"] = 1000
        code[4]["check_runs"][0]["id"] = 1000
        code[4]["check_runs"][0]["details_url"] = (
            f"https://github.com/{REPOSITORY}/actions/runs/"
            f"{PROBES[1]['run']}/job/1000")
        with self.assertRaisesRegex(
                ValueError, "^CONTROLLED_CROSS_PR_CONTEXT_COMPARISON_REFUSED$"):
            compare_real_pr_contexts(docs, tuple(code))

    def test_missing_expected_name_in_completed_run_fails_closed(self):
        docs = evidence(0, True)
        code = list(evidence(1, True))
        code[3]["jobs"].pop(-1)
        code[4]["check_runs"].pop(-1)
        code[3]["total_count"] -= 1
        code[4]["total_count"] -= 1
        with self.assertRaisesRegex(
                ValueError, "^CONTROLLED_CROSS_PR_CONTEXT_COMPARISON_REFUSED$"):
            compare_real_pr_contexts(docs, tuple(code))

    def test_docs_pr_with_code_change_is_not_docs_only(self):
        docs = list(evidence(0, True))
        docs[1].append({"filename": "react-prototype/scripts/evil.py",
                        "status": "added"})
        with self.assertRaisesRegex(
                ValueError, "^CONTROLLED_CROSS_PR_CONTEXT_COMPARISON_REFUSED$"):
            compare_real_pr_contexts(tuple(docs), evidence(1, True))

    def test_code_pr_without_expected_real_script_is_refused(self):
        code = list(evidence(1, True))
        code[1].pop(-1)
        with self.assertRaisesRegex(
                ValueError, "^CONTROLLED_CROSS_PR_CONTEXT_COMPARISON_REFUSED$"):
            compare_real_pr_contexts(evidence(0, True), tuple(code))

    def test_wrong_pr_head_base_branch_or_event_refused(self):
        for which in (0, 1):
            for change in ("head", "base", "draft", "event", "number"):
                left, right = list(evidence(0, True)), list(evidence(1, True))
                target = left if which == 0 else right
                if change == "head":
                    target[0]["head"]["sha"] = "e" * 40
                elif change == "base":
                    target[0]["base"]["ref"] = "main"
                elif change == "draft":
                    target[0]["draft"] = False
                elif change == "event":
                    target[2]["event"] = "push"
                else:
                    target[0]["number"] = 999
                with self.subTest(which=which, change=change):
                    with self.assertRaisesRegex(
                            ValueError,
                            "^CONTROLLED_CROSS_PR_CONTEXT_COMPARISON_REFUSED$"):
                        compare_real_pr_contexts(tuple(left), tuple(right))

    def test_check_run_wrong_app_name_sha_or_url_refused(self):
        for kind in ("app", "name", "head_sha", "details_url"):
            code = list(evidence(1, True))
            check = code[4]["check_runs"][0]
            if kind == "app":
                check["app"]["slug"] = "some-other-app"
            elif kind == "name":
                check["name"] = "fake-green-check"
            elif kind == "head_sha":
                check["head_sha"] = "f"*40
            else:
                check["details_url"] = (
                    f"https://github.com/{REPOSITORY}/actions/runs/"
                    "99999999/job/2000")
                # Foreign checks are excluded; completed cannot claim complete.
            with self.subTest(kind=kind):
                with self.assertRaisesRegex(
                        ValueError,
                        "^CONTROLLED_CROSS_PR_CONTEXT_COMPARISON_REFUSED$"):
                    compare_real_pr_contexts(evidence(0, True), tuple(code))

    def test_unknown_check_name_or_duplicated_job_is_refused(self):
        for mutation in ("unknown", "duplicate", "invalid count"):
            code = list(evidence(1, True))
            if mutation == "unknown":
                code[3]["jobs"][0]["name"] = "invented check"
            elif mutation == "duplicate":
                code[3]["jobs"][0]["name"] = code[3]["jobs"][1]["name"]
            else:
                code[4]["total_count"] = True
            with self.subTest(mutation=mutation):
                with self.assertRaisesRegex(
                        ValueError,
                        "^CONTROLLED_CROSS_PR_CONTEXT_COMPARISON_REFUSED$"):
                    compare_real_pr_contexts(evidence(0, True), tuple(code))

    def test_fake_success_while_run_in_progress_is_refused(self):
        code = list(evidence(1))
        code[2]["conclusion"] = "success"
        with self.assertRaisesRegex(
                ValueError, "^CONTROLLED_CROSS_PR_CONTEXT_COMPARISON_REFUSED$"):
            compare_real_pr_contexts(evidence(0, True), tuple(code))

    def test_github_rest_routes_are_fixed_read_only_and_pinned(self):
        info = {30: evidence(0, True), 31: evidence(1, False)}
        calls = []
        def fake_api(token, path):
            self.assertEqual(token, TOKEN)
            calls.append(path)
            for number, (pr, files, run, jobs, checks) in info.items():
                rid = run["id"]
                if path == f"repos/{REPOSITORY}/pulls/{number}":
                    return pr
                if path == f"repos/{REPOSITORY}/pulls/{number}/files?per_page=100":
                    return files
                if path == f"repos/{REPOSITORY}/actions/runs/{rid}":
                    return run
                if path == (f"repos/{REPOSITORY}/actions/runs/{rid}"
                            "/jobs?per_page=100&filter=latest"):
                    return jobs
                if path == (f"repos/{REPOSITORY}/commits/"
                            f"{PROBES[0 if number == 30 else 1]['head']}"
                            "/check-runs?per_page=100"):
                    return checks
            raise AssertionError("unexpected API path")
        with patch("controlled_cross_pr_check_contexts._api_json",
                   side_effect=fake_api):
            result = query_cross_pr_contexts(TOKEN)
        self.assertEqual(len(calls), 10)
        self.assertEqual(result["comparisonStatus"], "codeRunStillInProgress")
        self.assertTrue(all(x.startswith("repos/" + REPOSITORY + "/")
                            for x in calls))
        self.assert_no_release(result)

    def test_private_data_and_head_sha_not_exposed_in_report(self):
        report = compare_real_pr_contexts(evidence(0, True), evidence(1, True))
        exposed = json.dumps(report)
        for secret in (TOKEN, PROBES[0]["head"], PROBES[1]["head"],
                       "secret.o3d", "password", "ghp_"):
            self.assertNotIn(secret, exposed)
        self.assert_no_release(report)


if __name__ == "__main__":
    unittest.main()
