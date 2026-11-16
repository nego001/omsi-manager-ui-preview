"""M26: live GitHub Actions proof for a PR changing ONLY one docs file.

Read-only CI witness. A triggered workflow and authentic GitHub check-run
IDs do NOT prove a passing safety gate, configured required check, valid
mod, or release approval. All probe identities are pinned to a controlled
Draft PR created specifically for this CI-only experiment.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import sys

# Required for Python -I; trust only this checked-out scripts directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from controlled_base_policy_audit import _api_json
from controlled_ci_context_readiness import catalog_from_workflow

REPOSITORY = "nego001/omsi-manager-ui-preview"
DOCS_PROBE_PR = 30
DOCS_PROBE_RUN_ID = 43785621826
DOCS_PROBE_HEAD = "3d600a8b186484ae04e8f8a64d7185e8d2a8cddf"
DOCS_PROBE_BASE = "7879d10780c4a89c11350e137f71600ce34d19d0"
DOCS_PROBE_BRANCH = "test/m26-docs-only-ci-trigger-v1"
DOCS_PROBE_BASE_BRANCH = "feat/github-unfiltered-required-ci-coverage-v1"
DOCS_PROBE_FILE = "docs/ci-m26-docs-only-trigger-probe.md"
WORKFLOW = "React Prototype Validation"
CHECK_APP = "github-actions"
SCHEMA = "github-docs-only-check-run-observation-v1"
MAX_RECORDS = 90
VALID_STATUS = ("queued", "waiting", "in_progress", "completed", "pending")
VALID_CONCLUSION = (
    "success", "failure", "cancelled", "timed_out", "skipped",
    "neutral", "action_required", "stale", None
)
STRICT_X11_24_NAME = (
    "Native Auto X11 real-window check (ubuntu-24.04, strict sandbox)"
)
PROOF_MINIMUM = (
    "build",
    "Synthetic fixture two-revision comparison (CI only)",
)


def _refuse():
    raise ValueError("CONTROLLED_DOCS_ONLY_CHECK_RUN_AUDIT_REFUSED")


def _positive(value):
    return type(value) is int and value > 0


def observe_docs_only_check_runs(pr, changes, run, jobs_payload,
                                 checks_payload, workflow_source):
    """Cross-verify a REAL docs-only PR and its matching Actions check runs."""
    if (type(pr) is not dict or type(changes) is not list or
            type(run) is not dict or type(jobs_payload) is not dict or
            type(checks_payload) is not dict or
            type(workflow_source) is not str):
        _refuse()
    catalog = catalog_from_workflow(workflow_source, "main")
    if (catalog["pullRequestPathFiltered"] is not False or
            catalog["defaultBranchPushCovered"] is not True):
        _refuse()
    permitted_names = frozenset(catalog["expandedNames"])
    head = pr.get("head")
    base = pr.get("base")
    if (pr.get("number") != DOCS_PROBE_PR or
            type(pr.get("number")) is not int or
            pr.get("draft") is not True or pr.get("state") != "open" or
            type(head) is not dict or type(base) is not dict or
            head.get("sha") != DOCS_PROBE_HEAD or
            head.get("ref") != DOCS_PROBE_BRANCH or
            base.get("sha") != DOCS_PROBE_BASE or
            base.get("ref") != DOCS_PROBE_BASE_BRANCH or
            type(base.get("repo")) is not dict or
            base["repo"].get("full_name") != REPOSITORY):
        _refuse()
    if len(changes) != 1 or type(changes[0]) is not dict:
        _refuse()
    only = changes[0]
    if (only.get("filename") != DOCS_PROBE_FILE or
            only.get("status") != "added" or
            type(only.get("changes")) is not int or
            not 0 < only["changes"] <= 200):
        _refuse()

    linked = run.get("pull_requests")
    if (run.get("id") != DOCS_PROBE_RUN_ID or
            type(run.get("id")) is not int or
            run.get("name") != WORKFLOW or
            run.get("event") != "pull_request" or
            run.get("head_sha") != DOCS_PROBE_HEAD or
            run.get("head_branch") != DOCS_PROBE_BRANCH or
            type(run.get("repository")) is not dict or
            run["repository"].get("full_name") != REPOSITORY or
            type(linked) is not list or
            not any(type(item) is dict and
                    type(item.get("number")) is int and
                    item["number"] == DOCS_PROBE_PR for item in linked) or
            run.get("status") not in VALID_STATUS or
            run.get("conclusion") not in VALID_CONCLUSION):
        _refuse()

    jobs = jobs_payload.get("jobs")
    count = jobs_payload.get("total_count")
    if (type(jobs) is not list or type(count) is not int or
            not 2 <= count <= MAX_RECORDS or len(jobs) != count):
        _refuse()
    jobs_by_id = {}
    for job in jobs:
        if (type(job) is not dict or not _positive(job.get("id")) or
                type(job.get("name")) is not str or
                job["name"] not in permitted_names or
                job.get("status") not in VALID_STATUS or
                job.get("conclusion") not in VALID_CONCLUSION or
                job["id"] in jobs_by_id):
            _refuse()
        jobs_by_id[job["id"]] = job
    check_runs = checks_payload.get("check_runs")
    total_checks = checks_payload.get("total_count")
    if (type(check_runs) is not list or
            type(total_checks) is not int or
            not 2 <= total_checks <= MAX_RECORDS or
            len(check_runs) != total_checks):
        _refuse()
    matched = {}
    excluded_other_run = 0
    for check in check_runs:
        if type(check) is not dict or not _positive(check.get("id")):
            _refuse()
        details = (
            f"https://github.com/{REPOSITORY}/actions/runs/"
            f"{DOCS_PROBE_RUN_ID}/job/{check['id']}"
        )
        if check.get("details_url") != details:
            excluded_other_run += 1
            continue
        app = check.get("app")
        job = jobs_by_id.get(check["id"])
        if (type(app) is not dict or app.get("slug") != CHECK_APP or
                job is None or check.get("name") != job["name"] or
                check.get("head_sha") != DOCS_PROBE_HEAD or
                check.get("status") not in VALID_STATUS or
                check.get("conclusion") not in VALID_CONCLUSION or
                check["id"] in matched):
            _refuse()
        matched[check["id"]] = check

    observed_names = {c["name"] for c in matched.values()}
    if not set(PROOF_MINIMUM) <= observed_names:
        _refuse()
    if len(observed_names) != len(matched):
        # Ambiguous duplicate check names are not safe candidates for
        # future required-check configuration.
        _refuse()
    evidence = [
        {
            "checkRunId": key,
            "name": value["name"],
            "state": value["status"],
            "conclusion": value["conclusion"],
            "sourceApp": CHECK_APP,
        }
        for key, value in sorted(matched.items())
    ]
    strict = next(
        (c for c in evidence if c["name"] == STRICT_X11_24_NAME), None)
    return {
        "schema": SCHEMA,
        "evidenceType": "live-github-actions-check-runs",
        "docsOnlyPullRequest": True,
        "changedFileCount": 1,
        "pullRequestEventRunVerified": True,
        "runId": DOCS_PROBE_RUN_ID,
        "observedRealCheckRunCount": len(evidence),
        "observedCheckRuns": evidence,
        "excludedForeignRunChecks": excluded_other_run,
        "strictUbuntu24CheckRunPresent": strict is not None,
        "strictUbuntu24ConclusionAtObservation":
            strict["conclusion"] if strict is not None else None,
        "allChecksCompletedVerified": False,
        "mainBranchWorkflowInstalled": False,
        "requiredContextIDsSelected": [],
        "requiredStatusChecksConfigured": False,
        "ubuntu24StrictSandboxWaived": False,
        "mergeAuthorized": False,
        "realModValidated": False,
        "installationAuthorized": False,
    }


def query_real_docs_only_probe(token, workflow_source):
    """Fixed read-only REST endpoints. No caller-supplied repo, SHA or PR."""
    if type(token) is not str or not (16 <= len(token) <= 512):
        _refuse()
    root = "repos/" + REPOSITORY
    pr = _api_json(token, root + "/pulls/" + str(DOCS_PROBE_PR))
    changes = _api_json(token, root + "/pulls/" +
                        str(DOCS_PROBE_PR) + "/files?per_page=100")
    run = _api_json(token, root + "/actions/runs/" + str(DOCS_PROBE_RUN_ID))
    jobs = _api_json(token, root + "/actions/runs/" +
                     str(DOCS_PROBE_RUN_ID) +
                     "/jobs?per_page=100&filter=latest")
    checks = _api_json(token, root + "/commits/" +
                       DOCS_PROBE_HEAD + "/check-runs?per_page=100")
    return observe_docs_only_check_runs(
        pr, changes, run, jobs, checks, workflow_source)


def main():
    if (os.environ.get("GITHUB_ACTIONS") != "true" or
            os.environ.get("GH_M26_EVENT") != "pull_request" or
            len(sys.argv) != 1):
        _refuse()
    try:
        source = (Path(__file__).resolve().parents[2] /
                  ".github/workflows/react-prototype.yml").read_text("utf-8")
    except (OSError, UnicodeError):
        _refuse()
    report = query_real_docs_only_probe(
        os.environ.get("GH_M26_TOKEN", ""), source)
    print(json.dumps(report, separators=(",", ":"), sort_keys=True))


if __name__ == "__main__":
    try:
        main()
    except ValueError:
        print("CONTROLLED_DOCS_ONLY_CHECK_RUN_AUDIT_REFUSED",
              file=sys.stderr)
        raise SystemExit(1)
