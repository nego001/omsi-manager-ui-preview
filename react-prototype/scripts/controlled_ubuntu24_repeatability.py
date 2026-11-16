"""M28: repeatability audit for THREE completed historical strict-X11 CI runs.

The only network access is bounded read-only GitHub REST, limited to
previously observed pinned runs. Matching past failures is not causal proof
or evidence that the current revision succeeds. No host changes, bypasses,
real OMSI mods, installation, or automatic release decisions.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import sys

# Under Python -I, trust only this checked-out scripts directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from controlled_base_policy_audit import _api_json
from controlled_cross_pr_check_contexts import (
    CORE_NAMES, M26_ADDED, STRICT_24, REPOSITORY,
)

SCHEMA = "ubuntu24-three-run-strict-gate-repeatability-v1"
STRICT_22 = "Native Auto X11 real-window check (ubuntu-22.04, strict sandbox)"
FORENSIC = "Compare sanitized X11 host evidence (no sandbox changes)"
GATES = ("build", STRICT_22, STRICT_24, FORENSIC)
PROBES = (
    {
        "kind": "codeM25", "run": 43784985561, "pr": 29,
        "head": "7879d10780c4a89c11350e137f71600ce34d19d0",
        "branch": "feat/github-unfiltered-required-ci-coverage-v1",
        "extra": False,
    },
    {
        "kind": "docsOnlyM26", "run": 43785621826, "pr": 30,
        "head": "3d600a8b186484ae04e8f8a64d7185e8d2a8cddf",
        "branch": "test/m26-docs-only-ci-trigger-v1",
        "extra": False,
    },
    {
        "kind": "codeM26", "run": 43786218414, "pr": 31,
        "head": "fcd5bcbae3829a9ae06651782fa4f054e53fa193",
        "branch": "feat/github-docs-only-check-run-attestation-v1",
        "extra": True,
    },
)

def _refuse():
    raise ValueError("CONTROLLED_UBUNTU24_REPEATABILITY_REFUSED")


def _one(spec: dict, run: dict, response: dict) -> dict:
    """Verify exact run and all job conclusions; never accept partial jobs."""
    if (type(spec) is not dict or type(run) is not dict or
            type(response) is not dict or
            type(run.get("id")) is not int or run["id"] != spec["run"] or
            run.get("event") != "pull_request" or
            run.get("name") != "React Prototype Validation" or
            run.get("head_sha") != spec["head"] or
            run.get("head_branch") != spec["branch"] or
            run.get("status") != "completed" or
            run.get("conclusion") != "failure" or
            type(run.get("repository")) is not dict or
            run["repository"].get("full_name") != REPOSITORY):
        _refuse()
    linked = run.get("pull_requests")
    if (type(linked) is not list or
            not any(type(p) is dict and type(p.get("number")) is int and
                    p["number"] == spec["pr"] for p in linked)):
        _refuse()
    jobs = response.get("jobs")
    expected = set(CORE_NAMES)
    if spec["extra"]:
        expected.add(M26_ADDED)
    if (type(jobs) is not list or
            type(response.get("total_count")) is not int or
            response["total_count"] != len(expected) or
            len(jobs) != len(expected)):
        _refuse()
    by_name = {}
    ids = set()
    for job in jobs:
        if (type(job) is not dict or
                type(job.get("name")) is not str or
                type(job.get("id")) is not int or job["id"] <= 0 or
                job["id"] in ids or job["name"] in by_name or
                job.get("status") != "completed" or
                job.get("conclusion") not in ("success", "failure") or
                ("run_id" in job and
                 (type(job["run_id"]) is not int or
                  job["run_id"] != spec["run"]))):
            _refuse()
        ids.add(job["id"])
        by_name[job["name"]] = job
    if set(by_name) != expected:
        _refuse()
    failed = [name for name, job in by_name.items()
              if job["conclusion"] == "failure"]
    historical = (
        failed == [STRICT_24] and
        all(by_name[name]["conclusion"] == "success"
            for name in ("build", STRICT_22, FORENSIC))
    )
    return {
        "kind": spec["kind"],
        "run": spec["run"],
        "jobs": len(by_name),
        "failures": len(failed),
        "ubuntu24Failed": by_name[STRICT_24]["conclusion"] == "failure",
        "ubuntu22Passed": by_name[STRICT_22]["conclusion"] == "success",
        "buildPassed": by_name["build"]["conclusion"] == "success",
        "forensicComparisonPassed":
            by_name[FORENSIC]["conclusion"] == "success",
        "historicalPattern": historical,
    }


def compare_three_historical_strict_runs(rows: tuple) -> dict:
    """Triangulate completed CI conclusions, NOT AppArmor/Chromium cause."""
    if (type(rows) is not tuple or len(rows) != len(PROBES) or
            any(type(row) is not tuple or len(row) != 2 for row in rows)):
        _refuse()
    observations = tuple(_one(spec, *row)
                         for spec, row in zip(PROBES, rows))
    unchanged = all(item["historicalPattern"] for item in observations)
    return {
        "schema": SCHEMA,
        "source": "github-read-only-historical-actions-jobs",
        "comparisonStatus": (
            "threeHistoricalStrictFailuresRepeated" if unchanged else
            "historicalGateOutcomesChangedNeedsReview"
        ),
        "completedPinnedRunsCompared": len(observations),
        "eachRunBoundToExpectedPullRequestAndSha": True,
        "totalHistoricalJobsObserved": sum(x["jobs"] for x in observations),
        "ubuntu24StrictFailureRuns": sum(x["ubuntu24Failed"]
                                         for x in observations),
        "ubuntu22StrictSuccessRuns": sum(x["ubuntu22Passed"]
                                         for x in observations),
        "buildSuccessRuns": sum(x["buildPassed"] for x in observations),
        "forensicComparisonSuccessRuns": sum(
            x["forensicComparisonPassed"] for x in observations),
        "runsWithOnlyUbuntu24Failed": sum(
            x["historicalPattern"] for x in observations),
        "perRunSummary": [
            {"kind": x["kind"], "runId": x["run"],
             "jobCount": x["jobs"], "failedJobCount": x["failures"],
             "ubuntu24StrictFailed": x["ubuntu24Failed"],
             "ubuntu22StrictPassed": x["ubuntu22Passed"],
             "onlyUbuntu24Failed": x["historicalPattern"]}
            for x in observations
        ],
        "sameBinaryAcrossDifferentCommitsProven": False,
        "sameHostKernelBetweenRunsProven": False,
        "apparmorCausesSigtrapProven": False,
        "rendererSandboxCertified": False,
        "adminPilotApproved": False,
        "adminPolicyProfileCreated": False,
        "hostPolicyChanged": False,
        "sandboxBypassApplied": False,
        "currentRevisionStrictUbuntu24Passing": False,
        "ubuntu24StrictFailureWaived": False,
        "branchProtectionSatisfied": False,
        "mergeAuthorized": False,
        "realModValidated": False,
        "installationAuthorized": False,
    }


def query_historical_runs(token: str) -> dict:
    if type(token) is not str or not 16 <= len(token) <= 512:
        _refuse()
    base = "repos/" + REPOSITORY + "/actions/runs/"
    result = []
    for spec in PROBES:
        rid = str(spec["run"])
        run = _api_json(token, base + rid)
        jobs = _api_json(
            token, base + rid + "/jobs?per_page=100&filter=latest")
        result.append((run, jobs))
    return compare_three_historical_strict_runs(tuple(result))


def main():
    if (os.environ.get("GITHUB_ACTIONS") != "true" or
            os.environ.get("GH_M28_EVENT") != "pull_request" or
            len(sys.argv) != 1):
        _refuse()
    result = query_historical_runs(os.environ.get("GH_M28_TOKEN", ""))
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    if result["comparisonStatus"] != "threeHistoricalStrictFailuresRepeated":
        raise SystemExit(1)


if __name__ == "__main__":
    try:
        main()
    except ValueError:
        print("CONTROLLED_UBUNTU24_REPEATABILITY_REFUSED",
              file=sys.stderr)
        raise SystemExit(1)
