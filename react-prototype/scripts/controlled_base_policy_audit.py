"""M22: read-only observation of GitHub base-branch rules and CODEOWNERS.

Observing rules NEVER means satisfying branch protection, CODEOWNERS review,
mergability, or the separate Ubuntu 24.04 strict sandbox. No modification,
no approval, no real OMSI files. Only the CI wrapper reads GitHub metadata.
"""
from __future__ import annotations

import base64
import json
import os
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import HTTPRedirectHandler, Request, build_opener

SCHEMA = "github-base-branch-policy-observation-v1"
SHA = re.compile(r"^[0-9a-f]{40}$")
REPO = re.compile(r"^[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}$")
BRANCH = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]{0,180}$")
SOURCES = ("github", "root", "docs")
SOURCE_PATHS = (".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS")
MAX_RULES = 99
MAX_CODEOWNERS_BYTES = 128_000


def _refuse():
    raise ValueError("CONTROLLED_BASE_POLICY_AUDIT_REFUSED")


def _validate_input(repo, number, head_sha, base_name, base_sha, token=None):
    if (type(repo) is not str or not REPO.fullmatch(repo) or
            any(part in (".", "..") for part in repo.split("/")) or
            type(number) is not int or not (1 <= number <= 10_000_000) or
            type(head_sha) is not str or not SHA.fullmatch(head_sha) or
            type(base_sha) is not str or not SHA.fullmatch(base_sha) or
            type(base_name) is not str or not BRANCH.fullmatch(base_name) or
            base_name.startswith("/") or base_name.endswith("/") or
            any(part in ("", ".", "..") for part in base_name.split("/"))):
        _refuse()
    if token is not None and (type(token) is not str or
                              not (16 <= len(token) <= 512)):
        _refuse()


def observe_base_branch_policy(repo: str, number: int, head_sha: str,
                               base_name: str, base_sha: str,
                               pr: dict, branch: dict, active_rules: list,
                               owners: dict) -> dict:
    """Observe only policy evidence, never assert requirement satisfaction.

    owners maps github/root/docs to optional bytes fetched from the exact
    base commit SHA; no owner identities or file paths leave this function.
    """
    _validate_input(repo, number, head_sha, base_name, base_sha)
    if (type(pr) is not dict or type(branch) is not dict or
            type(active_rules) is not list or len(active_rules) > MAX_RULES or
            type(owners) is not dict or set(owners) != set(SOURCES)):
        _refuse()
    head = pr.get("head")
    base = pr.get("base")
    if (pr.get("number") != number or type(pr.get("number")) is not int or
            pr.get("state") != "open" or type(pr.get("draft")) is not bool or
            type(head) is not dict or type(base) is not dict or
            head.get("sha") != head_sha or
            base.get("ref") != base_name or base.get("sha") != base_sha or
            type(base.get("repo")) is not dict or
            type(base["repo"].get("full_name")) is not str or
            base["repo"]["full_name"].lower() != repo.lower() or
            branch.get("name") != base_name or
            type(branch.get("commit")) is not dict or
            branch["commit"].get("sha") != base_sha or
            type(branch.get("protected")) is not bool):
        _refuse()

    review_rules = 0
    codeowner_rule = False
    status_rules = 0
    declared_min_reviews = 0
    for rule in active_rules:
        if type(rule) is not dict or type(rule.get("type")) is not str:
            _refuse()
        name = rule["type"]
        if len(name) > 80:
            _refuse()
        if name == "pull_request":
            params = rule.get("parameters")
            if (type(params) is not dict or
                    type(params.get("required_approving_review_count")) is not int or
                    not 0 <= params["required_approving_review_count"] <= 50 or
                    type(params.get("require_code_owner_review")) is not bool):
                _refuse()
            review_rules += 1
            declared_min_reviews = max(
                declared_min_reviews, params["required_approving_review_count"])
            codeowner_rule |= params["require_code_owner_review"]
        elif name == "required_status_checks":
            status_rules += 1

    present = [source for source in SOURCES if owners[source] is not None]
    for source in SOURCES:
        content = owners[source]
        if content is not None and (type(content) is not bytes or
                                    len(content) > MAX_CODEOWNERS_BYTES):
            _refuse()

    selected = present[0] if present else None
    candidate_lines = 0
    if selected is not None:
        try:
            text = owners[selected].decode("utf-8")
        except UnicodeDecodeError:
            _refuse()
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            # Candidate assignment count is only a hint, NOT a CODEOWNERS
            # coverage/matcher result or proof that listed owners have access.
            if len(line.split()) >= 2:
                candidate_lines += 1
                if candidate_lines > 4000:
                    _refuse()

    if pr["draft"]:
        status = "draftUnreviewedPolicyObservation"
    elif not branch["protected"] and not active_rules:
        status = "noEnforcedRulesObservedNotApproval"
    elif review_rules:
        status = "activeReviewRuleObservedNotSatisfied"
    else:
        status = "incompleteBranchProtectionEvidence"

    return {
        "schema": SCHEMA,
        "source": "github-read-only-base-branch-metadata",
        "policyObservationStatus": status,
        "exactHeadAndBaseCommitMatched": True,
        "draftPullRequest": pr["draft"],
        "baseBranchProtectedFlagReported": branch["protected"],
        "activeRulesReported": len(active_rules),
        "activePullRequestReviewRulesReported": review_rules,
        "activeRequiredStatusCheckRulesReported": status_rules,
        "maximumRuleReviewCountObserved": declared_min_reviews,
        "activeCodeownerReviewRuleObserved": codeowner_rule,
        "codeownersFileOnBaseBranch": selected is not None,
        "codeownersSourceCategory": selected or "none",
        "codeownersCandidateAssignmentLines": candidate_lines,
        "codeownersCoverageVerified": False,
        "classicProtectionDetailsVerified": False,
        "branchProtectionSatisfied": False,
        "requiredChecksSatisfied": False,
        "independentCodeownerApprovalVerified": False,
        "mergeEligibilityVerified": False,
        "ubuntu24StrictSandboxGateWaived": False,
        "realModValidated": False,
        "installationAuthorized": False,
    }


class _NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _api_json(token: str, path: str, allow_missing: bool = False):
    # The GitHub REST API hostname is static; no redirects or user URLs.
    if type(path) is not str or not path.startswith("repos/") or "://" in path:
        _refuse()
    request = Request("https://api.github.com/" + path, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "omsi-manager-base-policy-readonly",
    })
    try:
        with build_opener(_NoRedirects).open(request, timeout=9) as response:
            blob = response.read(600_001)
        if len(blob) > 600_000:
            _refuse()
        return json.loads(blob)
    except HTTPError as err:
        if err.code == 404 and allow_missing:
            return None
        _refuse()
    except (URLError, OSError, UnicodeError, json.JSONDecodeError):
        _refuse()


def _owners_bytes(response):
    if type(response) is not dict or response.get("type") != "file" or (
            response.get("encoding") != "base64"):
        _refuse()
    encoded = response.get("content")
    size = response.get("size")
    if (type(encoded) is not str or len(encoded) > MAX_CODEOWNERS_BYTES * 2 or
            type(size) is not int or not (0 <= size <= MAX_CODEOWNERS_BYTES)):
        _refuse()
    try:
        content = base64.b64decode("".join(encoded.split()), validate=True)
    except (ValueError, base64.binascii.Error):
        _refuse()
    if len(content) != size:
        _refuse()
    return content


def query_base_branch_policy(repo: str, number: int, head_sha: str,
                             base_name: str, base_sha: str, token: str) -> dict:
    """Read-only GitHub endpoint calls; base CODEOWNERS pinned to base SHA."""
    _validate_input(repo, number, head_sha, base_name, base_sha, token)
    base = "repos/" + repo
    path_branch = quote(base_name, safe="")
    pr = _api_json(token, base + "/pulls/" + str(number))
    branch = _api_json(token, base + "/branches/" + path_branch)
    rules = _api_json(token, base + "/rules/branches/" +
                      path_branch + "?per_page=100")
    if type(rules) is not list or len(rules) > MAX_RULES:
        _refuse()
    owners = {}
    for name, filename in zip(SOURCES, SOURCE_PATHS):
        response = _api_json(token, base + "/contents/" + filename +
                             "?ref=" + base_sha, allow_missing=True)
        owners[name] = None if response is None else _owners_bytes(response)
    return observe_base_branch_policy(
        repo, number, head_sha, base_name, base_sha,
        pr, branch, rules, owners)


def main():
    if (os.environ.get("GITHUB_ACTIONS") != "true" or
            os.environ.get("GH_POLICY_EVENT") != "pull_request" or
            len(sys.argv) != 1):
        _refuse()
    try:
        number = int(os.environ.get("GH_POLICY_PR_NUMBER", ""))
    except ValueError:
        _refuse()
    result = query_base_branch_policy(
        os.environ.get("GH_POLICY_REPOSITORY", ""),
        number,
        os.environ.get("GH_POLICY_HEAD_SHA", ""),
        os.environ.get("GH_POLICY_BASE_REF", ""),
        os.environ.get("GH_POLICY_BASE_SHA", ""),
        os.environ.get("GH_POLICY_TOKEN", ""),
    )
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except ValueError:
        print("CONTROLLED_BASE_POLICY_AUDIT_REFUSED", file=sys.stderr)
        raise SystemExit(1)
