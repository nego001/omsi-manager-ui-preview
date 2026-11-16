"""M27: read-only comparison of REAL GitHub Actions check contexts across PRs.

Compare PR #30 (docs-only, M25) to PR #31 (code + one NEW M26 job).
This verifies matching check-run names AND GitHub Actions app identities, not
stable check-run numerical IDs: IDs correctly differ between executions.

Do not claim passing tests, configured required checks, merge eligibility,
production release, or sandbox bypass. No GitHub write operations.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from controlled_base_policy_audit import _api_json

REPOSITORY = "nego001/omsi-manager-ui-preview"
APP = "github-actions"
SCHEMA = "github-cross-pr-check-context-comparison-v1"
MAX_RECORDS = 90
MAX_FILES = 20
CORE_NAMES = (
    "build",
    "Windows standalone native directory lab (test-only)",
    "Windows portable preview (not signed)",
    "GitHub CI context readiness audit (no branch rule writes)",
    "Synthetic fixture two-revision comparison (CI only)",
    "GitHub base branch rules and CODEOWNERS observation (no approval)",
    "GitHub independent PR review observation (read-only; no approval)",
    "GitHub default branch protection rollout proposal (read-only)",
    "Arch Linux x64 container / ELF runtime audit (no GUI)",
    "Windows + Linux archives / same-commit read-only provenance",
    "Native Auto X11 real-window check (ubuntu-24.04, strict sandbox)",
    "Native Auto X11 real-window check (ubuntu-22.04, strict sandbox)",
    "Compare sanitized X11 host evidence (no sandbox changes)",
)
M26_ADDED = "GitHub docs-only CI check-run evidence (read-only, not approval)"
STRICT_24 = "Native Auto X11 real-window check (ubuntu-24.04, strict sandbox)"
DOC_FILE = "docs/ci-m26-docs-only-trigger-probe.md"
CODE_REQUIRED = frozenset((
    ".github/workflows/react-prototype.yml",
    "react-prototype/scripts/controlled_docs_only_check_runs.py",
    "react-prototype/scripts/test_controlled_docs_only_check_runs.py",
))
BASE_BRANCH = "feat/github-unfiltered-required-ci-coverage-v1"
BASE_SHA = "7879d10780c4a89c11350e137f71600ce34d19d0"
PROBES = (
    {
        "label": "docsOnly", "number": 30, "run": 43785621826,
        "branch": "test/m26-docs-only-ci-trigger-v1",
        "head": "3d600a8b186484ae04e8f8a64d7185e8d2a8cddf",
    },
    {
        "label": "codeChanges", "number": 31, "run": 43786218414,
        "branch": "feat/github-docs-only-check-run-attestation-v1",
        "head": "fcd5bcbae3829a9ae06651782fa4f054e53fa193",
    },
)
STATES = frozenset(("queued", "waiting", "pending", "in_progress", "completed"))
CONCLUSIONS = frozenset((
    "success", "failure", "cancelled", "timed_out", "skipped", "neutral",
    "action_required", "stale", None
))


def _refuse():
    raise ValueError("CONTROLLED_CROSS_PR_CONTEXT_COMPARISON_REFUSED")


def _is_positive(value):
    return type(value) is int and value > 0


def _bounded_records(container, key):
    if (type(container) is not dict or
            type(container.get("total_count")) is not int or
            type(container.get(key)) is not list or
            not (1 <= container["total_count"] <= MAX_RECORDS) or
            len(container[key]) != container["total_count"]):
        _refuse()
    return container[key]


def _observe_one(spec, pr, files, run, jobs, checks):
    if (type(spec) is not dict or type(pr) is not dict or
            type(files) is not list or type(run) is not dict or
            not (1 <= len(files) <= MAX_FILES)):
        _refuse()
    head, base = pr.get("head"), pr.get("base")
    if (type(pr.get("number")) is not int or
            pr["number"] != spec["number"] or
            pr.get("state") != "open" or pr.get("draft") is not True or
            type(head) is not dict or type(base) is not dict or
            head.get("sha") != spec["head"] or
            head.get("ref") != spec["branch"] or
            base.get("sha") != BASE_SHA or base.get("ref") != BASE_BRANCH or
            type(base.get("repo")) is not dict or
            base["repo"].get("full_name") != REPOSITORY):
        _refuse()
    names = []
    for file in files:
        if (type(file) is not dict or
                type(file.get("filename")) is not str or
                type(file.get("status")) is not str):
            _refuse()
        names.append(file["filename"])
    if len(set(names)) != len(names):
        _refuse()
    if spec["label"] == "docsOnly":
        if names != [DOC_FILE] or files[0]["status"] != "added":
            _refuse()
    elif spec["label"] == "codeChanges":
        if not CODE_REQUIRED.issubset(names) or DOC_FILE in names:
            _refuse()
    else:
        _refuse()

    linked = run.get("pull_requests")
    if (type(run.get("id")) is not int or
            run["id"] != spec["run"] or
            run.get("name") != "React Prototype Validation" or
            run.get("event") != "pull_request" or
            run.get("head_sha") != spec["head"] or
            run.get("head_branch") != spec["branch"] or
            type(run.get("repository")) is not dict or
            run["repository"].get("full_name") != REPOSITORY or
            type(linked) is not list or
            not any(type(p) is dict and type(p.get("number")) is int and
                    p["number"] == spec["number"] for p in linked) or
            run.get("status") not in STATES or
            run.get("conclusion") not in CONCLUSIONS):
        _refuse()
    if (run["status"] == "completed" and run["conclusion"] is None) or (
            run["status"] != "completed" and run["conclusion"] is not None):
        _refuse()

    permitted = set(CORE_NAMES)
    if spec["label"] == "codeChanges":
        permitted.add(M26_ADDED)
    job_rows = _bounded_records(jobs, "jobs")
    by_id, by_name = {}, {}
    for job in job_rows:
        if (type(job) is not dict or not _is_positive(job.get("id")) or
                type(job.get("name")) is not str or
                job["name"] not in permitted or
                job["id"] in by_id or job["name"] in by_name or
                job.get("status") not in STATES or
                job.get("conclusion") not in CONCLUSIONS):
            _refuse()
        if (job["status"] == "completed" and job["conclusion"] is None) or (
                job["status"] != "completed" and job["conclusion"] is not None):
            _refuse()
        by_id[job["id"]] = job
        by_name[job["name"]] = job
    if not {"build", "Synthetic fixture two-revision comparison (CI only)"} <= set(by_name):
        _refuse()

    checks_rows = _bounded_records(checks, "check_runs")
    matched = {}
    foreign = 0
    for check in checks_rows:
        if type(check) is not dict or not _is_positive(check.get("id")):
            _refuse()
        expected_url = (f"https://github.com/{REPOSITORY}/actions/runs/"
                        f"{spec['run']}/job/{check['id']}")
        if check.get("details_url") != expected_url:
            foreign += 1
            continue
        job = by_id.get(check["id"])
        app = check.get("app")
        if (job is None or type(app) is not dict or app.get("slug") != APP or
                check.get("name") != job["name"] or
                check.get("head_sha") != spec["head"] or
                check.get("status") not in STATES or
                check.get("conclusion") not in CONCLUSIONS or
                check["id"] in matched):
            _refuse()
        matched[check["id"]] = check
    if not matched or len({x["name"] for x in matched.values()}) != len(matched):
        _refuse()
    # Both APIs can be consulted at slightly different instants; a job may
    # first appear in Actions before its check run is observable.
    shared = {c["name"] for c in matched.values()}
    if not {"build", "Synthetic fixture two-revision comparison (CI only)"} <= shared:
        _refuse()
    completed = run["status"] == "completed"
    if completed and (set(by_name) != permitted or shared != permitted):
        # A completed run missing a mandatory expected check is NOT stable.
        _refuse()
    strict = by_name.get(STRICT_24)
    return {
        "label": spec["label"],
        "run": spec["run"],
        "completed": completed,
        "names": shared,
        "identities": {name: (job["id"], APP)
                       for name, job in by_name.items() if name in shared},
        "pending": len(permitted - shared),
        "foreign": foreign,
        "strict24Present": STRICT_24 in shared,
        "strict24Failed": bool(strict and strict["conclusion"] == "failure"),
        "failureCount": sum(j["conclusion"] == "failure"
                            for j in by_name.values()),
    }


def compare_real_pr_contexts(docs: tuple, code: tuple) -> dict:
    """Observe overlap, known added check, and unresolved work distinctly."""
    if type(docs) is not tuple or len(docs) != 5 or (
            type(code) is not tuple or len(code) != 5):
        _refuse()
    left = _observe_one(PROBES[0], *docs)
    right = _observe_one(PROBES[1], *code)
    shared = sorted(left["names"] & right["names"])
    # A numerical check-run ID is per-execution, not an evergreen required
    # context; the stable candidate identity is (check name, Actions app).
    if any(left["identities"][name][0] == right["identities"][name][0]
           for name in shared):
        _refuse()
    if left["completed"] and right["completed"]:
        status = "completedSharedNamesAndAppObserved"
    elif not left["completed"]:
        status = "docsOnlyRunStillInProgress"
    else:
        status = "codeRunStillInProgress"
    return {
        "schema": SCHEMA,
        "evidenceType": "live-github-actions-check-run-identity-overlap",
        "comparisonStatus": status,
        "docsOnlyPullRequest": True,
        "codePullRequest": True,
        "docsOnlyRunId": left["run"],
        "codeRunId": right["run"],
        "docsOnlyRunComplete": left["completed"],
        "codeRunComplete": right["completed"],
        "docsOnlyObservedCheckCount": len(left["names"]),
        "codeObservedCheckCount": len(right["names"]),
        "sharedCheckNamesAndSourceApp": [
            {"name": name, "app": APP} for name in shared
        ],
        "sharedNameAndAppCount": len(shared),
        "docsOnlyPendingExpectedNames": left["pending"],
        "codePendingExpectedNames": right["pending"],
        "docsOnlyForeignChecksExcluded": left["foreign"],
        "codeForeignChecksExcluded": right["foreign"],
        "codeOnlyNewM26CheckObserved": M26_ADDED in right["names"],
        "docsOnlyUbuntu24StrictFailureObserved": left["strict24Failed"],
        "codeUbuntu24StrictFailureObserved": right["strict24Failed"],
        "comparisonIsProofAllJobsPass": False,
        "checkRunIdsAreStableAcrossRuns": False,
        "requiredCheckContextsSelected": [],
        "requiredCheckContextsConfigured": False,
        "mainBranchWorkflowInstalledVerified": False,
        "ubuntu24StrictSandboxWaived": False,
        "mergeAuthorized": False,
        "installationAuthorized": False,
    }


def _query(spec, token):
    prefix = "repos/" + REPOSITORY
    n, rid = spec["number"], spec["run"]
    return (
        _api_json(token, prefix + "/pulls/" + str(n)),
        _api_json(token, prefix + "/pulls/" + str(n) + "/files?per_page=100"),
        _api_json(token, prefix + "/actions/runs/" + str(rid)),
        _api_json(token, prefix + "/actions/runs/" + str(rid) +
                  "/jobs?per_page=100&filter=latest"),
        _api_json(token, prefix + "/commits/" + spec["head"] +
                  "/check-runs?per_page=100"),
    )


def query_cross_pr_contexts(token):
    if type(token) is not str or not (16 <= len(token) <= 512):
        _refuse()
    return compare_real_pr_contexts(
        _query(PROBES[0], token), _query(PROBES[1], token))


def main():
    if (os.environ.get("GITHUB_ACTIONS") != "true" or
            os.environ.get("GH_M27_EVENT") != "pull_request" or
            len(sys.argv) != 1):
        _refuse()
    result = query_cross_pr_contexts(os.environ.get("GH_M27_TOKEN", ""))
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except ValueError:
        print("CONTROLLED_CROSS_PR_CONTEXT_COMPARISON_REFUSED",
              file=sys.stderr)
        raise SystemExit(1)
