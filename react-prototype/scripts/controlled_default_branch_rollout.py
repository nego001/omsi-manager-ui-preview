"""M23: conservative, read-only rollout PLAN for default-branch protections.

Never installs rules, creates CODEOWNERS, chooses reviewers, approves a PR,
modifies the repository or treats an observational GitHub API result as
branch-protection satisfaction. The plan is advisory only. No real mods.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import quote

# Python -I removes the script directory. Trust only this checked-out
# source directory, never cwd/PYTHONPATH or an external module location.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from controlled_base_policy_audit import (
    _api_json, _owners_bytes, MAX_RULES, MAX_CODEOWNERS_BYTES,
    SOURCE_PATHS, SOURCES
)

SCHEMA = "github-default-branch-protection-rollout-plan-v1"
REPO = re.compile(r"^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$")
BRANCH = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]{0,180}$")
SHA = re.compile(r"^[0-9a-f]{40}$")
PHASES = (
    "inventoryCurrentDefaultBranch",
    "nominateIndependentReviewer",
    "reviewNonActiveCodeownersProposal",
    "verifyActualRequiredCheckContexts",
    "resolveUbuntu24StrictSandboxEvidence",
    "dryRunAndManuallyEnableDefaultBranchRules",
)
ADVISORY_FIELDS_ALWAYS_FALSE = (
    "reviewerIdentityVerified",
    "proposedCodeownersActivated",
    "requiredChecksConfigured",
    "branchProtectionEnforcedByThisPlan",
    "branchProtectionSatisfied",
    "requiredStatusChecksSatisfied",
    "codeownerApprovalSatisfied",
    "mergeAllowed",
    "ubuntu24StrictSandboxWaived",
    "realModValidated",
    "installationAuthorized",
)


def _refuse():
    raise ValueError("CONTROLLED_DEFAULT_BRANCH_PLAN_REFUSED")


def _branch_valid(branch: object) -> bool:
    return (type(branch) is str and BRANCH.fullmatch(branch) is not None
            and all(part not in ("", ".", "..") for part in branch.split("/")))


def assess_default_branch_rollout(
        repository: dict, branch: dict, active_rules: list,
        codeowners: dict, expected_repository: str) -> dict:
    """Inventory exact default branch and propose only non-operative phases.

    All inputs originate from bounded GitHub read-only metadata queries.
    Returns static phase IDs plus sanitized counters; never actionable API
    payloads, usernames, file contents or ruleset mutation instructions.
    """
    if (type(expected_repository) is not str or
            not REPO.fullmatch(expected_repository) or
            any(part in (".", "..") for part in expected_repository.split("/"))
            or type(repository) is not dict or type(branch) is not dict
            or type(active_rules) is not list or len(active_rules) > MAX_RULES
            or type(codeowners) is not dict or set(codeowners) != set(SOURCES)):
        _refuse()
    default = repository.get("default_branch")
    full_name = repository.get("full_name")
    if (not _branch_valid(default) or type(full_name) is not str or
            full_name.lower() != expected_repository.lower() or
            repository.get("archived") is not False or
            type(repository.get("private")) is not bool or
            branch.get("name") != default or
            type(branch.get("protected")) is not bool or
            type(branch.get("commit")) is not dict or
            type(branch["commit"].get("sha")) is not str or
            not SHA.fullmatch(branch["commit"]["sha"])):
        _refuse()

    review_rules = 0
    status_rules = 0
    codeowner_review_rules = 0
    max_reviews_observed = 0
    for entry in active_rules:
        if type(entry) is not dict or type(entry.get("type")) is not str:
            _refuse()
        kind = entry["type"]
        if len(kind) > 80:
            _refuse()
        if kind == "pull_request":
            params = entry.get("parameters")
            if (type(params) is not dict or
                    type(params.get("required_approving_review_count")) is not int or
                    not (0 <= params["required_approving_review_count"] <= 50) or
                    type(params.get("require_code_owner_review")) is not bool):
                _refuse()
            review_rules += 1
            codeowner_review_rules += int(params["require_code_owner_review"])
            max_reviews_observed = max(
                max_reviews_observed, params["required_approving_review_count"])
        elif kind == "required_status_checks":
            status_rules += 1

    for origin in SOURCES:
        contents = codeowners[origin]
        if (contents is not None and
                (type(contents) is not bytes or
                 len(contents) > MAX_CODEOWNERS_BYTES)):
            _refuse()

    chosen = next((origin for origin in SOURCES
                   if codeowners[origin] is not None), "none")
    assignment_lines = 0
    if chosen != "none":
        try:
            text = codeowners[chosen].decode("utf-8")
        except UnicodeDecodeError:
            _refuse()
        for line in text.splitlines():
            line = line.strip()
            if line and not line.startswith("#") and len(line.split()) >= 2:
                assignment_lines += 1
                if assignment_lines > 4000:
                    _refuse()

    if chosen == "none":
        state = "needsVerifiedIndependentCodeowner"
    elif not branch["protected"] and not active_rules:
        state = "needsManualProtectionDesign"
    else:
        state = "existingControlsRequireManualReview"

    return {
        "schema": SCHEMA,
        "source": "github-read-only-default-branch-inventory",
        "planMode": "advisoryOnly",
        "defaultBranchScope": "repositoryDefaultBranch",
        "repositoryDefaultBranchMatched": True,
        "defaultBranchName": default,
        "branchProtectedFlagReported": branch["protected"],
        "activeRulesReported": len(active_rules),
        "activePullRequestRulesReported": review_rules,
        "activeStatusCheckRulesReported": status_rules,
        "codeownerReviewRulesObserved": codeowner_review_rules,
        "maximumReviewCountObserved": max_reviews_observed,
        "codeownersPresentOnDefaultBranch": chosen != "none",
        "codeownersSourceCategory": chosen,
        "codeownersCandidateAssignmentLines": assignment_lines,
        "rolloutStatus": state,
        "proposedPhaseIds": list(PHASES),
        "selectedRequiredCheckContexts": [],
        "independentReviewerLoginProposed": False,
        "classicProtectionDetailsVerified": False,
        "allEffectiveRuleSourcesVerified": False,
        **{key: False for key in ADVISORY_FIELDS_ALWAYS_FALSE},
    }


def query_live_default_branch_plan(repository: str, token: str) -> dict:
    """Only fixed GitHub API hostname, no API mutation calls or custom paths."""
    if (type(repository) is not str or not REPO.fullmatch(repository) or
            any(part in (".", "..") for part in repository.split("/")) or
            type(token) is not str or not (16 <= len(token) <= 512)):
        _refuse()
    prefix = "repos/" + repository
    repo_meta = _api_json(token, prefix)
    if type(repo_meta) is not dict or not _branch_valid(
            repo_meta.get("default_branch")):
        _refuse()
    default = repo_meta["default_branch"]
    branch_meta = _api_json(
        token, prefix + "/branches/" + quote(default, safe=""))
    rule_data = _api_json(
        token, prefix + "/rules/branches/" +
        quote(default, safe="") + "?per_page=100")
    if type(rule_data) is not list or len(rule_data) > MAX_RULES:
        _refuse()
    if (type(branch_meta) is not dict or
            type(branch_meta.get("commit")) is not dict):
        _refuse()
    base_sha = branch_meta["commit"].get("sha")
    if type(base_sha) is not str or not SHA.fullmatch(base_sha):
        _refuse()
    codeowners = {}
    for source, path in zip(SOURCES, SOURCE_PATHS):
        data = _api_json(token, prefix + "/contents/" + path
                         + "?ref=" + base_sha, allow_missing=True)
        codeowners[source] = None if data is None else _owners_bytes(data)

    return assess_default_branch_rollout(
        repo_meta, branch_meta, rule_data, codeowners, repository)


def main():
    if (os.environ.get("GITHUB_ACTIONS") != "true" or
            os.environ.get("GH_DEFAULT_PLAN_EVENT") != "pull_request" or
            len(sys.argv) != 1):
        _refuse()
    result = query_live_default_branch_plan(
        os.environ.get("GH_DEFAULT_PLAN_REPOSITORY", ""),
        os.environ.get("GH_DEFAULT_PLAN_TOKEN", ""),
    )
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except ValueError:
        print("CONTROLLED_DEFAULT_BRANCH_PLAN_REFUSED", file=sys.stderr)
        raise SystemExit(1)
