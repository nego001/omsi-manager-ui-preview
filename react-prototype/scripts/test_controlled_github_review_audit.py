"""M21 adversarial GitHub PR review evidence contracts (no network calls)."""
import json
import unittest
from unittest.mock import patch

from controlled_github_review_audit import (
    MAX_REVIEWS, SCHEMA, _api_json, observe_independent_pr_reviews,
    query_live_review_observation,
)

HEAD = "a" * 40
OLD_HEAD = "b" * 40
TOKEN = "TEST_READ_ONLY_TOKEN_DO_NOT_USE"
REPO = "test-owner/synthetic-omsi-repo"


def pr(draft=False, head=HEAD, author="project-owner"):
    return {
        "number": 25, "state": "open", "draft": draft,
        "head": {"sha": head}, "user": {"login": author, "type": "User"},
    }


def review(login="separate-reviewer", state="APPROVED", commit=HEAD,
           permission_association="COLLABORATOR", user_type="User",
           submitted="2026-11-15T17:10:00Z", uid=100):
    return {
        "id": uid, "state": state, "commit_id": commit,
        "submitted_at": submitted,
        "author_association": permission_association,
        "user": {"login": login, "type": user_type},
    }


def audit(pull=None, reviews=None, permissions=None):
    return observe_independent_pr_reviews(
        pr() if pull is None else pull,
        [] if reviews is None else reviews,
        {} if permissions is None else permissions, 25, HEAD)


class GithubIndependentReviewObservationTests(unittest.TestCase):
    def assert_safety(self, result):
        self.assertEqual(result["schema"], SCHEMA)
        self.assertEqual(result["source"], "github-read-only-rest-metadata")
        self.assertTrue(result["currentHeadMatched"])
        for key in ("verifiedRealHumanIdentity", "branchProtectionSatisfied",
                    "m20RegressionGateWaived", "pullRequestAutoMergeAllowed",
                    "ubuntu24StrictSandboxGateWaived", "realModValidated",
                    "installationAuthorized"):
            self.assertIs(result[key], False)

    def test_current_draft_without_github_reviews_remains_pending(self):
        result = audit(pr(draft=True))
        self.assertEqual(result["reviewStatus"], "draftPendingIndependentReview")
        self.assertEqual(result["submittedReviewCount"], 0)
        self.assertEqual(result["independentCurrentHeadApprovalCount"], 0)
        self.assertIs(result["independentReviewEvidenceObserved"], False)
        self.assertTrue(result["draftPullRequest"])
        self.assert_safety(result)

    def test_open_pr_with_no_reviews_is_not_approved(self):
        result = audit()
        self.assertEqual(result["reviewStatus"], "independentReviewPending")
        self.assertFalse(result["independentReviewEvidenceObserved"])
        self.assert_safety(result)

    def test_independent_current_commit_review_with_write_permission_observed(self):
        result = audit(
            reviews=[review()],
            permissions={"separate-reviewer": "write"})
        self.assertEqual(result["reviewStatus"],
                         "independentApprovalObservedNotRelease")
        self.assertEqual(result["independentCurrentHeadApprovalCount"], 1)
        self.assertTrue(result["independentReviewEvidenceObserved"])
        self.assert_safety(result)

    def test_approval_on_draft_is_evidence_not_release(self):
        result = audit(
            pull=pr(draft=True),
            reviews=[review()],
            permissions={"separate-reviewer": "admin"})
        self.assertEqual(result["reviewStatus"], "draftPendingIndependentReview")
        self.assertEqual(result["independentCurrentHeadApprovalCount"], 1)
        self.assertFalse(result["branchProtectionSatisfied"])
        self.assertFalse(result["pullRequestAutoMergeAllowed"])

    def test_author_cannot_self_approve(self):
        result = audit(reviews=[review(login="project-owner")])
        self.assertEqual(result["reviewStatus"], "independentReviewPending")
        self.assertEqual(result["independentCurrentHeadApprovalCount"], 0)
        self.assert_safety(result)

    def test_bot_comment_or_untrusted_association_cannot_approve(self):
        for item, perm in (
            (review(user_type="Bot"), {}),
            (review(permission_association="CONTRIBUTOR"), {}),
            (review(state="COMMENTED"), {}),
            (review(state="PENDING", submitted=None), {}),
            (review(), {"separate-reviewer": "read"}),
            (review(), {"separate-reviewer": "triage"}),
            (review(), {"separate-reviewer": "none"}),
        ):
            with self.subTest(case=(item["state"], item["author_association"])):
                output = audit(reviews=[item], permissions=perm)
                self.assertEqual(output["independentCurrentHeadApprovalCount"], 0)
                self.assertFalse(output["independentReviewEvidenceObserved"])
                self.assert_safety(output)

    def test_previous_commit_approval_not_current(self):
        result = audit(
            reviews=[review(commit=OLD_HEAD)],
            permissions={"separate-reviewer": "write"})
        self.assertEqual(result["reviewStatus"],
                         "approvalOnPreviousCommitNotCurrentHead")
        self.assertEqual(result["outdatedApprovalCount"], 1)
        self.assertEqual(result["independentCurrentHeadApprovalCount"], 0)
        self.assert_safety(result)

    def test_latest_change_request_overrides_previous_approval(self):
        result = audit(
            reviews=[
                review(uid=41, submitted="2026-11-15T12:00:00Z"),
                review(uid=42, state="CHANGES_REQUESTED",
                       submitted="2026-11-15T18:00:00Z"),
            ],
            permissions={"separate-reviewer": "write"})
        self.assertEqual(result["reviewStatus"], "independentChangesRequested")
        self.assertEqual(result["independentChangesRequestedCount"], 1)
        self.assertEqual(result["independentCurrentHeadApprovalCount"], 0)
        self.assert_safety(result)

    def test_latest_dismissed_or_comment_cannot_reuse_old_approval(self):
        for state in ("DISMISSED", "COMMENTED"):
            with self.subTest(state=state):
                result = audit(
                    reviews=[
                        review(uid=1, submitted="2026-11-15T09:00:00Z"),
                        review(uid=2, state=state,
                               submitted="2026-11-15T21:00:00Z"),
                    ])
                self.assertEqual(result["reviewStatus"], "independentReviewPending")
                self.assertEqual(result["independentCurrentHeadApprovalCount"], 0)
                self.assert_safety(result)

    def test_new_approval_supersedes_old_change_request(self):
        result = audit(
            reviews=[
                review(uid=1, state="CHANGES_REQUESTED",
                       submitted="2026-11-15T08:00:00Z"),
                review(uid=2, state="APPROVED",
                       submitted="2026-11-15T21:00:00Z"),
            ],
            permissions={"separate-reviewer": "maintain"})
        self.assertEqual(result["reviewStatus"],
                         "independentApprovalObservedNotRelease")
        self.assertEqual(result["independentCurrentHeadApprovalCount"], 1)

    def test_unverified_collaborator_permissions_fail_closed(self):
        with self.assertRaisesRegex(
                ValueError, "^CONTROLLED_GITHUB_REVIEW_AUDIT_REFUSED$"):
            audit(reviews=[review()], permissions={})
        with self.assertRaisesRegex(
                ValueError, "^CONTROLLED_GITHUB_REVIEW_AUDIT_REFUSED$"):
            audit(reviews=[review()], permissions={"unrelated-account": "write"})

    def test_wrong_pr_number_head_or_closed_pr_fail_closed(self):
        variants = (
            {**pr(), "number": 26},
            {**pr(), "head": {"sha": OLD_HEAD}},
            {**pr(), "state": "closed"},
            {**pr(), "draft": 1},
            {**pr(), "user": {"login": ""}},
            {**pr(), "head": {"sha": "private"}},
        )
        for item in variants:
            with self.subTest(kind=str(item.get("number"))):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_GITHUB_REVIEW_AUDIT_REFUSED$"):
                    audit(pull=item)

    def test_malformed_review_fields_and_over_budget_are_refused(self):
        bad = (
            [{**review(), "id": True}],
            [{**review(), "state": "FAKE_APPROVED"}],
            [{**review(), "commit_id": "x"}],
            [{**review(), "submitted_at": "PRIVATE"}],
            [{**review(), "user": {"login": "??", "type": "User"}}],
            [{**review(), "user": {"login": "someone", "type": "Machine"}}],
            [review(uid=i+1, state="COMMENTED") for i in range(MAX_REVIEWS + 1)],
        )
        for reviews in bad:
            with self.subTest(length=len(reviews)):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_GITHUB_REVIEW_AUDIT_REFUSED$"):
                    audit(reviews=reviews)

    def test_read_only_live_api_path_and_permission_check(self):
        calls = []
        def fake_api(token, path):
            self.assertEqual(token, TOKEN)
            calls.append(path)
            if path.endswith("/pulls/25"):
                return pr()
            if "/reviews?" in path:
                return [review()]
            if "/permission" in path:
                return {"permission": "write"}
            raise AssertionError("unexpected external API route")
        with patch("controlled_github_review_audit._api_json", side_effect=fake_api):
            result = query_live_review_observation(REPO, 25, HEAD, TOKEN)
        self.assertEqual(result["independentCurrentHeadApprovalCount"], 1)
        self.assertEqual(len(calls), 3)
        self.assertIn("/collaborators/separate-reviewer/permission", calls[-1])
        self.assert_safety(result)

    def test_live_api_malformed_response_or_pagination_overflow_refused(self):
        def fake_api(_token, path):
            if "/pulls/25/reviews?" in path:
                return [review(uid=i + 1) for i in range(100)]
            return pr()
        with patch("controlled_github_review_audit._api_json", side_effect=fake_api):
            with self.assertRaisesRegex(
                    ValueError, "^CONTROLLED_GITHUB_REVIEW_AUDIT_REFUSED$"):
                query_live_review_observation(REPO, 25, HEAD, TOKEN)

    def test_repository_and_token_cannot_change_api_host(self):
        for bad_repo in ("../private", "example.com/../outside",
                         "owner/repo/other", "", "owner//repo"):
            with self.subTest(repo=bad_repo):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_GITHUB_REVIEW_AUDIT_REFUSED$"):
                    query_live_review_observation(bad_repo, 25, HEAD, TOKEN)

    def test_public_result_never_contains_reviewer_identity_or_secret(self):
        result = audit(
            reviews=[review(login="separate-reviewer")],
            permissions={"separate-reviewer": "write"})
        exposed = json.dumps(result)
        for secret in ("separate-reviewer", "project-owner", TOKEN, HEAD,
                       "commit_id", "submitted_at", "reviewerLogin"):
            self.assertNotIn(secret, exposed)
        self.assert_safety(result)


if __name__ == "__main__":
    unittest.main()
