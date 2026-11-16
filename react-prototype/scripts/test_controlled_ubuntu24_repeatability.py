"""M28: adversarial tests for pinned real Ubuntu 24.04 CI-gate repeatability.

Synthetic API responses only. A repeated failure is NOT approval, causality,
a rollback plan, or proof of Chromium renderer confinement.
"""
import json
import unittest
from unittest.mock import patch

from controlled_ubuntu24_repeatability import (
    CORE_NAMES, M26_ADDED, PROBES, REPOSITORY, SCHEMA,
    STRICT_24, STRICT_22, FORENSIC,
    compare_three_historical_strict_runs, query_historical_runs,
)

TOKEN = "M28_TEST_ONLY_READ_TOKEN_12345678"


def evidence(spec, failing=STRICT_24):
    run = {
        "id": spec["run"], "event": "pull_request",
        "name": "React Prototype Validation",
        "head_sha": spec["head"], "head_branch": spec["branch"],
        "status": "completed", "conclusion": "failure",
        "repository": {"full_name": REPOSITORY},
        "pull_requests": [{"number": spec["pr"]}],
    }
    names = list(CORE_NAMES) + ([M26_ADDED] if spec["extra"] else [])
    jobs = [
        {"id": spec["run"] * 100 + index + 1,
         "run_id": spec["run"], "name": name,
         "status": "completed",
         "conclusion": "failure" if name == failing else "success"}
        for index, name in enumerate(names)
    ]
    return (run, {"total_count": len(jobs), "jobs": jobs})


def samples():
    return tuple(evidence(s) for s in PROBES)


class Ubuntu24ThreeRunReadOnlyContracts(unittest.TestCase):
    def assert_locked(self, report):
        self.assertEqual(report["schema"], SCHEMA)
        self.assertFalse(report["sameBinaryAcrossDifferentCommitsProven"])
        self.assertFalse(report["sameHostKernelBetweenRunsProven"])
        for name in (
            "apparmorCausesSigtrapProven", "rendererSandboxCertified",
            "adminPilotApproved", "adminPolicyProfileCreated",
            "hostPolicyChanged", "sandboxBypassApplied",
            "currentRevisionStrictUbuntu24Passing",
            "ubuntu24StrictFailureWaived", "branchProtectionSatisfied",
            "mergeAuthorized", "realModValidated", "installationAuthorized",
        ):
            self.assertIs(report[name], False)

    def test_three_real_shape_runs_repeat_only_ubuntu24_failure(self):
        report = compare_three_historical_strict_runs(samples())
        self.assertEqual(report["comparisonStatus"],
                         "threeHistoricalStrictFailuresRepeated")
        self.assertEqual(report["completedPinnedRunsCompared"], 3)
        self.assertEqual(report["totalHistoricalJobsObserved"], 40)
        self.assertEqual(report["ubuntu24StrictFailureRuns"], 3)
        self.assertEqual(report["ubuntu22StrictSuccessRuns"], 3)
        self.assertEqual(report["buildSuccessRuns"], 3)
        self.assertEqual(report["forensicComparisonSuccessRuns"], 3)
        self.assertEqual(report["runsWithOnlyUbuntu24Failed"], 3)
        self.assertEqual([x["jobCount"] for x in report["perRunSummary"]],
                         [13, 13, 14])
        self.assertTrue(all(x["failedJobCount"] == 1
                            for x in report["perRunSummary"]))
        self.assert_locked(report)

    def test_unexpected_new_failure_not_promoted_to_approval(self):
        rows = list(samples())
        rows[1] = evidence(PROBES[1], failing="build")
        report = compare_three_historical_strict_runs(tuple(rows))
        self.assertEqual(report["comparisonStatus"],
                         "historicalGateOutcomesChangedNeedsReview")
        self.assertEqual(report["ubuntu24StrictFailureRuns"], 2)
        self.assertEqual(report["ubuntu22StrictSuccessRuns"], 3)
        self.assertEqual(report["runsWithOnlyUbuntu24Failed"], 2)
        self.assert_locked(report)

    def test_ubuntu22_failure_is_not_a_pass(self):
        rows = list(samples())
        rows[0] = evidence(PROBES[0], failing=STRICT_22)
        report = compare_three_historical_strict_runs(tuple(rows))
        self.assertEqual(report["ubuntu22StrictSuccessRuns"], 2)
        self.assertEqual(report["runsWithOnlyUbuntu24Failed"], 2)
        self.assert_locked(report)

    def test_missing_or_skipped_strict_gate_refused(self):
        for target in (STRICT_24, STRICT_22, FORENSIC):
            rows = list(samples())
            run, response = rows[0]
            response["jobs"] = [j for j in response["jobs"]
                                if j["name"] != target]
            response["total_count"] -= 1
            with self.subTest(target=target):
                with self.assertRaisesRegex(
                    ValueError,
                    "^CONTROLLED_UBUNTU24_REPEATABILITY_REFUSED$"):
                    compare_three_historical_strict_runs(tuple(rows))
        rows = list(samples())
        rows[1][1]["jobs"][0]["conclusion"] = "skipped"
        with self.assertRaises(ValueError):
            compare_three_historical_strict_runs(tuple(rows))

    def test_incomplete_run_or_fake_success_refused(self):
        for update in (
            {"status": "in_progress", "conclusion": None},
            {"status": "completed", "conclusion": "success"},
            {"event": "push"},
            {"head_sha": "f" * 40},
            {"head_branch": "another-branch"},
            {"id": True},
            {"pull_requests": []},
            {"repository": {"full_name": "someone/private-repo"}},
        ):
            rows = list(samples())
            rows[0] = ({**rows[0][0], **update}, rows[0][1])
            with self.subTest(field=next(iter(update))):
                with self.assertRaisesRegex(
                    ValueError,
                    "^CONTROLLED_UBUNTU24_REPEATABILITY_REFUSED$"):
                    compare_three_historical_strict_runs(tuple(rows))

    def test_duplicate_or_forged_job_ids_and_counts_refused(self):
        for choice in ("duplicate-name", "duplicate-id", "boolean-id",
                       "wrong-run", "boolean-count"):
            rows = list(samples())
            _, payload = rows[2]
            if choice == "duplicate-name":
                payload["jobs"][0]["name"] = payload["jobs"][1]["name"]
            elif choice == "duplicate-id":
                payload["jobs"][0]["id"] = payload["jobs"][1]["id"]
            elif choice == "boolean-id":
                payload["jobs"][0]["id"] = True
            elif choice == "wrong-run":
                payload["jobs"][0]["run_id"] = 1
            else:
                payload["total_count"] = True
            with self.subTest(change=choice):
                with self.assertRaisesRegex(
                    ValueError,
                    "^CONTROLLED_UBUNTU24_REPEATABILITY_REFUSED$"):
                    compare_three_historical_strict_runs(tuple(rows))

    def test_missing_synthetic_m26_job_or_added_on_docs_run_refused(self):
        rows = list(samples())
        rows[2][1]["jobs"] = [j for j in rows[2][1]["jobs"]
                              if j["name"] != M26_ADDED]
        rows[2][1]["total_count"] -= 1
        with self.assertRaises(ValueError):
            compare_three_historical_strict_runs(tuple(rows))
        rows = list(samples())
        new = dict(rows[2][1]["jobs"][-1])
        new["id"] = 999
        rows[0][1]["jobs"].append(new)
        rows[0][1]["total_count"] += 1
        with self.assertRaises(ValueError):
            compare_three_historical_strict_runs(tuple(rows))

    def test_shape_forgery_or_missing_all_rows_refused(self):
        for value in ([], tuple(), [*samples()], samples()[:2],
                      tuple(("foo", "bar") for _ in range(3)),
                      (None, None, None)):
            with self.assertRaisesRegex(
                    ValueError,
                    "^CONTROLLED_UBUNTU24_REPEATABILITY_REFUSED$"):
                compare_three_historical_strict_runs(value)

    def test_real_api_calls_only_fixed_readonly_routes(self):
        data = {spec["run"]: evidence(spec) for spec in PROBES}
        calls = []
        def fake_api(token, route):
            self.assertEqual(token, TOKEN)
            calls.append(route)
            for run_id, (run, jobs) in data.items():
                if route == (f"repos/{REPOSITORY}/actions/runs/{run_id}"):
                    return run
                if route == (f"repos/{REPOSITORY}/actions/runs/{run_id}"
                             "/jobs?per_page=100&filter=latest"):
                    return jobs
            raise AssertionError("unexpected API route")
        with patch("controlled_ubuntu24_repeatability._api_json",
                   side_effect=fake_api):
            result = query_historical_runs(TOKEN)
        self.assertEqual(len(calls), 6)
        self.assertEqual(result["runsWithOnlyUbuntu24Failed"], 3)
        self.assertTrue(all(route.startswith("repos/"+REPOSITORY+"/")
                            for route in calls))
        self.assert_locked(result)

    def test_token_malformed_no_api_request(self):
        for bad in ("", "short", 21, None):
            with self.assertRaisesRegex(
                    ValueError,
                    "^CONTROLLED_UBUNTU24_REPEATABILITY_REFUSED$"):
                query_historical_runs(bad)

    def test_report_does_not_disclose_secrets_or_prove_causality(self):
        report = compare_three_historical_strict_runs(samples())
        exposed = json.dumps(report)
        for forbidden in (TOKEN, PROBES[0]["head"], PROBES[1]["head"],
                          PROBES[2]["head"], "USERNAME", "secret.o3d",
                          "profileName", "file_path", "rawStderr"):
            self.assertNotIn(forbidden, exposed)
        self.assert_locked(report)


if __name__ == "__main__":
    unittest.main()
