"""M24: read-only readiness audit of real GitHub Actions job names.

A job name is not automatically an approved required-check context.
This is a CI observation only: no branch-rule writes, sandbox bypass,
auto-merge, mod reading, installation or release.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import sys
from urllib.parse import quote

# Isolated Python -I: add only this source-controlled script directory.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from controlled_base_policy_audit import _api_json

SCHEMA = "github-ci-context-readiness-audit-v1"
REFERENCE_RUN_ID = 43781261747
REFERENCE_HEAD = "760159ab1c2fdfcc8268be83b7d0e2bcc8338623"
REPO_RE = re.compile(r"^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
JOB_RE = re.compile(r"^  ([a-z][a-z0-9_]*):\s*$", re.M)
NAME_RE = re.compile(r"^[A-Za-z0-9+ ._(),/&-]{1,150}$")
R24 = "Native Auto X11 real-window check (ubuntu-24.04, strict sandbox)"
R22 = "Native Auto X11 real-window check (ubuntu-22.04, strict sandbox)"
MAX_JOBS = 90


def refuse():
    raise ValueError("CONTROLLED_CI_CONTEXT_AUDIT_REFUSED")


def valid_repo(repo):
    return (type(repo) is str and REPO_RE.fullmatch(repo) is not None and
            all(x not in (".", "..") for x in repo.split("/")))


def catalog_from_workflow(source, default_branch):
    """Narrow, fail-closed parser for this workflow's top-level job labels.

    It does not claim to be a general YAML parser or compute required checks.
    """
    if (type(source) is not str or not 0 < len(source) <= 100_000 or
            "\r" in source or source.count("\njobs:\n") != 1 or
            type(default_branch) is not str or
            not re.fullmatch(r"[A-Za-z0-9._/-]{1,180}", default_branch)):
        refuse()
    header, body = source.split("\njobs:\n", 1)
    event = header.splitlines()
    if event.count("on:") != 1:
        refuse()

    def event_block(name):
        key = "  " + name + ":"
        if key not in event:
            return ""
        start = event.index(key)
        stop = next((i for i in range(start+1, len(event))
                     if re.match(r"^  [A-Za-z0-9_-]+:", event[i])),
                    len(event))
        return "\n".join(event[start:stop])

    pr = event_block("pull_request")
    push = event_block("push")
    if not pr:
        refuse()
    path_filtered = bool(re.search(r"(?m)^    paths:\s*$", pr))
    push_branches = re.search(r"(?m)^    branches: \[([^\]]+)\]\s*$", push)
    push_on_default = bool(
        push_branches and default_branch in
        [x.strip().strip("'\"") for x in push_branches.group(1).split(",")])

    markers = list(JOB_RE.finditer(body))
    if not markers or len(markers) > MAX_JOBS:
        refuse()
    ids = [m.group(1) for m in markers]
    if len(set(ids)) != len(ids) or not {"build", "native_auto_x11",
                                         "native_x11_evidence_compare"} <= set(ids):
        refuse()

    labels = []
    dependent = 0
    dependencies = {}
    for i, marker in enumerate(markers):
        job = body[marker.end():markers[i+1].start() if i+1 < len(markers)
                   else len(body)]
        n = re.findall(r"(?m)^    name: (.+)$", job)
        d = re.findall(r"(?m)^    needs: (.+)$", job)
        if len(n) > 1 or len(d) > 1:
            refuse()
        label = n[0].strip() if n else marker.group(1)
        needs = []
        if d:
            raw = d[0].strip()
            if re.fullmatch(r"[a-z][a-z0-9_]*", raw):
                needs = [raw]
            elif raw.startswith("[") and raw.endswith("]"):
                needs = [x.strip() for x in raw[1:-1].split(",")]
            else:
                refuse()
            if not needs or any(x not in ids or x == marker.group(1)
                                for x in needs):
                refuse()
            dependent += 1
        dependencies[marker.group(1)] = tuple(needs)

        if "${{ matrix.runner }}" in label:
            runners = re.findall(
                r"(?m)^        runner: \[([A-Za-z0-9., _-]+)\]\s*$", job)
            if len(runners) != 1 or marker.group(1) != "native_auto_x11":
                refuse()
            options = [x.strip() for x in runners[0].split(",")]
            if options != ["ubuntu-24.04", "ubuntu-22.04"]:
                refuse()
            labels.extend(label.replace(
                "${{ matrix.runner }}", name) for name in options)
        else:
            if "$" in label or "{" in label:
                refuse()
            labels.append(label)
    if (any(not NAME_RE.fullmatch(x) for x in labels) or
            len(set(labels)) != len(labels) or
            R24 not in labels or R22 not in labels or
            dependencies["native_auto_x11"] != ("build",) or
            dependencies["native_x11_evidence_compare"] !=
                ("build", "native_auto_x11")):
        refuse()
    return {
        "declaredJobs": len(ids),
        "expandedNames": tuple(labels),
        "jobsWithDependencies": dependent,
        "pullRequestPathFiltered": path_filtered,
        "defaultBranchPushCovered": push_on_default,
    }


def validate_run(data, repo, run_id, head, completed):
    if (type(data) is not dict or type(data.get("id")) is not int or
            data["id"] != run_id or data.get("head_sha") != head or
            data.get("event") != "pull_request" or
            type(data.get("repository")) is not dict or
            type(data["repository"].get("full_name")) is not str or
            data["repository"]["full_name"].lower() != repo.lower() or
            data.get("status") not in ("queued", "in_progress", "completed") or
            data.get("conclusion") not in
            ("success", "failure", "cancelled", "skipped", "timed_out", None)):
        refuse()
    if completed and (data["status"] != "completed" or
                      data["conclusion"] not in ("success", "failure")):
        refuse()


def validate_jobs(data, require_completed):
    if (type(data) is not dict or type(data.get("total_count")) is not int
            or not 0 <= data["total_count"] <= MAX_JOBS or
            type(data.get("jobs")) is not list or
            len(data["jobs"]) != data["total_count"]):
        refuse()
    result = {}
    for entry in data["jobs"]:
        if (type(entry) is not dict or type(entry.get("id")) is not int or
                type(entry.get("name")) is not str or
                not NAME_RE.fullmatch(entry["name"]) or
                entry["name"] in result or
                entry.get("status") not in
                ("queued", "in_progress", "completed", "waiting") or
                entry.get("conclusion") not in
                ("success", "failure", "skipped", "cancelled", "timed_out",
                 "neutral", None)):
            refuse()
        if require_completed and (entry["status"] != "completed" or
                                  entry["conclusion"] is None):
            refuse()
        result[entry["name"]] = entry
    return result


def evaluate_ci_context_readiness(source, repo_meta, branch_meta,
                                  main_workflow, reference_run,
                                  reference_jobs, current_run, current_jobs,
                                  expected_repo, current_id, current_head):
    if (not valid_repo(expected_repo) or type(current_id) is not int or
            current_id < 1 or type(current_head) is not str or
            not SHA_RE.fullmatch(current_head) or
            type(repo_meta) is not dict or
            type(repo_meta.get("full_name")) is not str or
            repo_meta["full_name"].lower() != expected_repo.lower() or
            type(repo_meta.get("default_branch")) is not str):
        refuse()
    default = repo_meta["default_branch"]
    if (type(branch_meta) is not dict or
            branch_meta.get("name") != default or
            type(branch_meta.get("commit")) is not dict or
            type(branch_meta["commit"].get("sha")) is not str or
            not SHA_RE.fullmatch(branch_meta["commit"]["sha"])):
        refuse()
    catalog = catalog_from_workflow(source, default)
    if main_workflow is not None and (
            type(main_workflow) is not dict or
            main_workflow.get("type") != "file" or
            main_workflow.get("name") != "react-prototype.yml" or
            type(main_workflow.get("sha")) is not str):
        refuse()
    validate_run(reference_run, expected_repo, REFERENCE_RUN_ID,
                 REFERENCE_HEAD, True)
    validate_run(current_run, expected_repo, current_id, current_head, False)
    baseline = validate_jobs(reference_jobs, True)
    current = validate_jobs(current_jobs, False)
    if R24 not in baseline or R22 not in baseline:
        refuse()
    known = [name for name in catalog["expandedNames"] if name in baseline]
    strict_failed = baseline[R24]["conclusion"] == "failure"
    if main_workflow is None:
        status = "defaultBranchWorkflowMissing"
    elif strict_failed:
        status = "ubuntu24ReferenceFailureBlocks"
    elif catalog["pullRequestPathFiltered"]:
        status = "pathFilteredChecksCanRemainPending"
    elif not catalog["defaultBranchPushCovered"]:
        status = "noDefaultBranchPushCoverage"
    else:
        status = "manualRequiredContextConfirmationNeeded"

    return {
        "schema": SCHEMA,
        "source": "read-only-actions-job-inventory",
        "auditStatus": status,
        "candidateWorkflowJobCount": catalog["declaredJobs"],
        "candidateExpandedJobNames": len(catalog["expandedNames"]),
        "observedPreviousJobNames": known,
        "missingCandidateNamesInPreviousRun":
            len(catalog["expandedNames"]) - len(known),
        "otherPreviousJobNamesCount":
            len(set(baseline) - set(catalog["expandedNames"])),
        "candidateJobsWithDependencies": catalog["jobsWithDependencies"],
        "previousCompletedJobCount": len(baseline),
        "currentJobCountAtObservation": len(current),
        "currentCompletedJobCountAtObservation":
            sum(x["status"] == "completed" for x in current.values()),
        "previousUbuntu24StrictFailure": strict_failed,
        "previousUbuntu22StrictSuccess":
            baseline[R22]["conclusion"] == "success",
        "candidatePullRequestPathFilterPresent":
            catalog["pullRequestPathFiltered"],
        "candidatePushCoversDefaultBranch":
            catalog["defaultBranchPushCovered"],
        "workflowPresentOnDefaultBranch": main_workflow is not None,
        "requiredCheckContextsSelected": [],
        "exactRequiredCheckContextsVerified": False,
        "defaultBranchWorkflowExecutedVerified": False,
        "safeToEnforceRequiredChecks": False,
        "branchRulesChanged": False,
        "ubuntu24SandboxWaived": False,
        "mergeAuthorized": False,
        "installationAuthorized": False,
    }


def query_live_context_readiness(repo, run_id, head, token, source):
    if (not valid_repo(repo) or type(run_id) is not int or run_id < 1 or
            type(head) is not str or not SHA_RE.fullmatch(head) or
            type(token) is not str or not 16 <= len(token) <= 512):
        refuse()
    root = "repos/" + repo
    meta = _api_json(token, root)
    if type(meta) is not dict or type(meta.get("default_branch")) is not str:
        refuse()
    branch = _api_json(
        token, root + "/branches/" + quote(meta["default_branch"], safe=""))
    if type(branch) is not dict or type(branch.get("commit")) is not dict:
        refuse()
    sha = branch["commit"].get("sha")
    if type(sha) is not str or not SHA_RE.fullmatch(sha):
        refuse()
    main_workflow = _api_json(
        token, root + "/contents/.github/workflows/react-prototype.yml?ref=" +
        sha, allow_missing=True)
    reference_run = _api_json(token, root + "/actions/runs/" +
                              str(REFERENCE_RUN_ID))
    reference_jobs = _api_json(
        token, root + "/actions/runs/" + str(REFERENCE_RUN_ID) +
        "/jobs?per_page=100&filter=latest")
    current_run = _api_json(token, root + "/actions/runs/" + str(run_id))
    current_jobs = _api_json(
        token, root + "/actions/runs/" + str(run_id) +
        "/jobs?per_page=100&filter=latest")
    return evaluate_ci_context_readiness(
        source, meta, branch, main_workflow,
        reference_run, reference_jobs, current_run,
        current_jobs, repo, run_id, head)


def main():
    if (os.environ.get("GITHUB_ACTIONS") != "true" or
            os.environ.get("GH_CONTEXT_EVENT") != "pull_request" or
            len(sys.argv) != 1):
        refuse()
    try:
        run_id = int(os.environ.get("GH_CONTEXT_RUN_ID", ""))
        source = (Path(__file__).resolve().parents[2] /
                  ".github/workflows/react-prototype.yml").read_text("utf-8")
    except (ValueError, OSError, UnicodeError):
        refuse()
    output = query_live_context_readiness(
        os.environ.get("GH_CONTEXT_REPOSITORY", ""),
        run_id, os.environ.get("GH_CONTEXT_HEAD_SHA", ""),
        os.environ.get("GH_CONTEXT_TOKEN", ""), source)
    print(json.dumps(output, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except ValueError:
        print("CONTROLLED_CI_CONTEXT_AUDIT_REFUSED", file=sys.stderr)
        raise SystemExit(1)
