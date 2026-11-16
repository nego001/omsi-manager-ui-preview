"""M21: read-only observation of independent GitHub PR review records in CI.

This is an AUXILIARY audit, not an approvals engine. It never approves a PR,
updates its state, merges, authenticates a person's real identity, or waives
the M20 regression and Ubuntu 24.04 sandbox gates. The pure classifier has
no network access. Only the CI entrypoint fetches bounded live GitHub API
metadata using a pull-requests:read scoped token; no names/tokens are printed.
"""
from __future__ import annotations

import json
import os
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

SCHEMA = "github-independent-pr-review-observation-v1"
MAX_REVIEWS = 199
MAX_PERMISSION_CHECKS = 16
SHA = re.compile(r"^[0-9a-f]{40}$")
LOGIN = re.compile(r"^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$")
NAME = re.compile(r"^[A-Za-z0-9_.-]{1,100}$")
TIME = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
ELIGIBLE_ASSOCIATIONS = frozenset(("OWNER", "MEMBER", "COLLABORATOR"))
WRITE_PERMISSIONS = frozenset(("write", "maintain", "admin"))
REVIEW_STATES = frozenset(
    ("APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED", "PENDING"))


def _refuse():
    raise ValueError("CONTROLLED_GITHUB_REVIEW_AUDIT_REFUSED")


def _login(value: object) -> str:
    if type(value) is not str or not LOGIN.fullmatch(value):
        _refuse()
    return value.lower()


def observe_independent_pr_reviews(
        pr: dict, reviews: list, permissions: dict,
        expected_number: int, expected_head_sha: str) -> dict:
    """Validate GitHub API metadata; return only fixed, anonymous findings.

    A reviewer counts only if the latest submitted review is on the EXACT
    current head, the author is not the reviewer, the reviewer is a User
    rather than a Bot, GitHub associates them with the repository, and
    GitHub reports write/maintain/admin permission. This does not replace
    branch protection or prove a real human controls the GitHub account.
    """
    if (type(pr) is not dict or type(reviews) is not list or
            type(permissions) is not dict or
            type(expected_number) is not int or expected_number < 1 or
            type(expected_head_sha) is not str or
            not SHA.fullmatch(expected_head_sha) or
            len(reviews) > MAX_REVIEWS or len(permissions) > MAX_PERMISSION_CHECKS):
        _refuse()

    head = pr.get("head")
    author = pr.get("user")
    if (type(pr.get("number")) is not int or
            pr["number"] != expected_number or
            pr.get("state") != "open" or
            type(pr.get("draft")) is not bool or
            type(head) is not dict or
            head.get("sha") != expected_head_sha or
            type(author) is not dict):
        _refuse()
    author_login = _login(author.get("login"))

    typed_permissions = {}
    for key, value in permissions.items():
        login = _login(key)
        if login in typed_permissions or type(value) is not str:
            _refuse()
        typed_permissions[login] = value

    latest = {}
    submitted_count = 0
    for item in reviews:
        if type(item) is not dict or type(item.get("id")) is not int:
            _refuse()
        state = item.get("state")
        if type(state) is not str or state not in REVIEW_STATES:
            _refuse()
        user = item.get("user")
        if user is None:
            continue  # A deleted account cannot be verified as a reviewer.
        if type(user) is not dict:
            _refuse()
        login = _login(user.get("login"))
        user_type = user.get("type")
        if type(user_type) is not str or user_type not in ("User", "Bot"):
            _refuse()
        association = item.get("author_association")
        if type(association) is not str or len(association) > 40:
            _refuse()
        if state == "PENDING":
            continue  # Unsubmitted drafts are never approval evidence.
        submitted_at = item.get("submitted_at")
        commit = item.get("commit_id")
        if (type(submitted_at) is not str or not TIME.fullmatch(submitted_at)
                or type(commit) is not str or not SHA.fullmatch(commit)):
            _refuse()
        submitted_count += 1
        key = (submitted_at, item["id"])
        if login not in latest or key > latest[login][0]:
            latest[login] = (key, state, commit, association, user_type)

    eligible = {}
    for login, (_, state, commit, association, user_type) in latest.items():
        if (login == author_login or user_type != "User" or
                association not in ELIGIBLE_ASSOCIATIONS or
                state not in ("APPROVED", "CHANGES_REQUESTED")):
            continue
        eligible[login] = (state, commit)

    if len(eligible) > MAX_PERMISSION_CHECKS:
        _refuse()
    # Missing GitHub collaborator permission is NOT assumed to be "write".
    # A declined API permission lookup must fail this audit closed.
    if not set(eligible).issubset(typed_permissions):
        _refuse()

    approved = 0
    changes_requested = 0
    stale_approvals = 0
    for login, (state, commit) in eligible.items():
        if typed_permissions[login] not in WRITE_PERMISSIONS:
            continue
        if commit != expected_head_sha:
            if state == "APPROVED":
                stale_approvals += 1
            continue
        if state == "APPROVED":
            approved += 1
        else:
            changes_requested += 1

    if pr["draft"]:
        status = "draftPendingIndependentReview"
    elif changes_requested:
        status = "independentChangesRequested"
    elif approved:
        status = "independentApprovalObservedNotRelease"
    elif stale_approvals:
        status = "approvalOnPreviousCommitNotCurrentHead"
    else:
        status = "independentReviewPending"

    return {
        "schema": SCHEMA,
        "source": "github-read-only-rest-metadata",
        "reviewStatus": status,
        "draftPullRequest": pr["draft"],
        "currentHeadMatched": True,
        "submittedReviewCount": submitted_count,
        "independentCurrentHeadApprovalCount": approved,
        "independentChangesRequestedCount": changes_requested,
        "outdatedApprovalCount": stale_approvals,
        "independentReviewEvidenceObserved": approved > 0,
        "verifiedRealHumanIdentity": False,
        "branchProtectionSatisfied": False,
        "m20RegressionGateWaived": False,
        "pullRequestAutoMergeAllowed": False,
        "ubuntu24StrictSandboxGateWaived": False,
        "realModValidated": False,
        "installationAuthorized": False,
    }


def _api_json(token: str, path: str):
    """Only GitHub's fixed REST host. Refuse all errors without logging."""
    url = "https://api.github.com/" + path
    request = Request(url, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "omsi-manager-synthetic-review-audit",
    })
    try:
        with urlopen(request, timeout=8) as response:
            body = response.read(512_001)
        if len(body) > 512_000:
            _refuse()
        return json.loads(body)
    except (HTTPError, URLError, OSError, UnicodeError,
            json.JSONDecodeError):
        _refuse()


def query_live_review_observation(
        repo: str, number: int, expected_sha: str, token: str) -> dict:
    """Bounded GitHub REST lookup performed ONLY in ephemeral CI."""
    if (type(repo) is not str or repo.count("/") != 1 or
            any(not NAME.fullmatch(part) or part in (".", "..")
                for part in repo.split("/")) or
            type(number) is not int or not 1 <= number <= 10_000_000 or
            type(expected_sha) is not str or not SHA.fullmatch(expected_sha) or
            type(token) is not str or not 16 <= len(token) <= 512):
        _refuse()
    base = "repos/" + repo
    pr = _api_json(token, base + "/pulls/" + str(number))
    reviews = []
    for page in (1, 2):
        page_data = _api_json(
            token, base + "/pulls/" + str(number) +
            "/reviews?per_page=100&page=" + str(page))
        if type(page_data) is not list:
            _refuse()
        reviews.extend(page_data)
        if len(page_data) < 100:
            break
        if page == 2:
            _refuse()

    # First validate all structural metadata, including head and author,
    # without trusting any self-declared approval text.
    preliminary_permissions = {}
    # Permission lookups are only needed for a valid, submitted, eligible
    # review's most recent entry. Invalid metadata will fail closed below.
    # Bound number of lookups even for a maliciously huge PR.
    if type(pr) is not dict or type(reviews) is not list:
        _refuse()
    author_obj = pr.get("user")
    author = _login(author_obj.get("login")) if type(author_obj) is dict else ""
    potential = set()
    for review in reviews:
        if type(review) is not dict:
            _refuse()
        user = review.get("user")
        if (review.get("state") in ("APPROVED", "CHANGES_REQUESTED") and
                type(user) is dict and user.get("type") == "User" and
                review.get("author_association") in ELIGIBLE_ASSOCIATIONS):
            login = _login(user.get("login"))
            if login != author:
                potential.add(login)
    if len(potential) > MAX_PERMISSION_CHECKS:
        _refuse()
    for login in potential:
        permission_info = _api_json(token, base + "/collaborators/" +
                                    quote(login, safe="") + "/permission")
        if (type(permission_info) is not dict or
                type(permission_info.get("permission")) is not str):
            _refuse()
        preliminary_permissions[login] = permission_info["permission"]
    return observe_independent_pr_reviews(
        pr, reviews, preliminary_permissions, number, expected_sha)


def main():
    if (os.environ.get("GITHUB_ACTIONS") != "true" or
            os.environ.get("GH_REVIEW_EVENT") != "pull_request" or
            len(sys.argv) != 1):
        _refuse()
    try:
        pr_number = int(os.environ.get("GH_REVIEW_PR_NUMBER", ""))
    except ValueError:
        _refuse()
    report = query_live_review_observation(
        os.environ.get("GH_REVIEW_REPOSITORY", ""),
        pr_number,
        os.environ.get("GH_REVIEW_HEAD_SHA", ""),
        os.environ.get("GH_REVIEW_TOKEN", ""))
    # Even an observed approval never makes a draft, failed sandbox, or
    # drifted comparison eligible for merge or production installation.
    print(json.dumps(report, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except ValueError:
        print("CONTROLLED_GITHUB_REVIEW_AUDIT_REFUSED", file=sys.stderr)
        raise SystemExit(1)
