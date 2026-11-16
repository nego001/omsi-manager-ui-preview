"""M22: simulated, no-network tests for GitHub base rules and CODEOWNERS."""
import base64
import json
import unittest
from unittest.mock import patch

from controlled_base_policy_audit import (
    MAX_RULES, SCHEMA, _owners_bytes,
    observe_base_branch_policy, query_base_branch_policy,
)

REPO = "fake-owner/synthetic-repository"
HEAD = "a" * 40
BASE_SHA = "b" * 40
BASE = "feat/controlled-fixture-review-policy-v1"
TOKEN = "TEST_TOKEN_ONLY_FAKE_123456789"


def pr(draft=True):
    return {
        "number": 26, "state": "open", "draft": draft,
        "head": {"sha": HEAD},
        "base": {"ref": BASE, "sha": BASE_SHA,
                 "repo": {"full_name": REPO}},
    }


def branch(protected=False):
    return {"name": BASE, "commit": {"sha": BASE_SHA},
            "protected": protected}


def owners(**kwargs):
    result = {"github": None, "root": None, "docs": None}
    result.update(kwargs)
    return result


def rule(approvals=1, require_codeowners=True):
    return {"type": "pull_request", "ruleset_id": 123,
            "parameters": {
                "required_approving_review_count": approvals,
                "require_code_owner_review": require_codeowners,
            }}


def audit(pr_info=None, branch_info=None, rules=None, codeowners=None):
    return observe_base_branch_policy(
        REPO, 26, HEAD, BASE, BASE_SHA,
        pr() if pr_info is None else pr_info,
        branch() if branch_info is None else branch_info,
        [] if rules is None else rules,
        owners() if codeowners is None else codeowners)


class BasePolicyObservationTests(unittest.TestCase):
    def assert_not_approved(self, result):
        self.assertEqual(result["schema"], SCHEMA)
        self.assertTrue(result["exactHeadAndBaseCommitMatched"])
        for name in ("codeownersCoverageVerified",
                     "classicProtectionDetailsVerified",
                     "branchProtectionSatisfied", "requiredChecksSatisfied",
                     "independentCodeownerApprovalVerified",
                     "mergeEligibilityVerified",
                     "ubuntu24StrictSandboxGateWaived",
                     "realModValidated", "installationAuthorized"):
            self.assertIs(result[name], False)

    def test_draft_without_rules_or_codeowners_is_not_approved(self):
        result = audit()
        self.assertEqual(result["policyObservationStatus"],
                         "draftUnreviewedPolicyObservation")
        self.assertEqual(result["activeRulesReported"], 0)
        self.assertFalse(result["codeownersFileOnBaseBranch"])
        self.assertEqual(result["codeownersSourceCategory"], "none")
        self.assert_not_approved(result)

    def test_explicit_ruleset_review_and_checks_are_observations_only(self):
        rules = [rule(2), rule(1, False), {"type": "required_status_checks"}]
        result = audit(pr_info=pr(draft=False), branch_info=branch(True),
                       rules=rules)
        self.assertEqual(result["policyObservationStatus"],
                         "activeReviewRuleObservedNotSatisfied")
        self.assertEqual(result["maximumRuleReviewCountObserved"], 2)
        self.assertEqual(result["activePullRequestReviewRulesReported"], 2)
        self.assertEqual(result["activeRequiredStatusCheckRulesReported"], 1)
        self.assertTrue(result["activeCodeownerReviewRuleObserved"])
        self.assertTrue(result["baseBranchProtectedFlagReported"])
        self.assert_not_approved(result)

    def test_branch_protected_flag_alone_is_not_proof(self):
        result = audit(pr_info=pr(draft=False), branch_info=branch(True))
        self.assertEqual(result["policyObservationStatus"],
                         "incompleteBranchProtectionEvidence")
        self.assertFalse(result["branchProtectionSatisfied"])
        self.assert_not_approved(result)

    def test_no_enforced_rules_reported_does_not_prove_absence_of_classic(self):
        result = audit(pr_info=pr(draft=False))
        self.assertEqual(result["policyObservationStatus"],
                         "noEnforcedRulesObservedNotApproval")
        self.assertFalse(result["classicProtectionDetailsVerified"])
        self.assert_not_approved(result)

    def test_codeowners_precedence_from_pinned_base(self):
        selected = owners(
            github=b"# ownership\n*.py @alice\n/.github/ @security\n",
            root=b"* @somebody\n", docs=b"*.md @docs-owner\n")
        result = audit(codeowners=selected)
        self.assertTrue(result["codeownersFileOnBaseBranch"])
        self.assertEqual(result["codeownersSourceCategory"], "github")
        self.assertEqual(result["codeownersCandidateAssignmentLines"], 2)
        self.assert_not_approved(result)
        root_only = audit(codeowners=owners(root=b"*.js @team\n",
                                          docs=b"*.md @docs"))
        self.assertEqual(root_only["codeownersSourceCategory"], "root")
        docs_only = audit(codeowners=owners(docs=b"* @owner\n"))
        self.assertEqual(docs_only["codeownersSourceCategory"], "docs")

    def test_empty_or_comments_only_is_present_but_not_coverage_proof(self):
        result = audit(codeowners=owners(github=b"# hi\n \n# another\n"))
        self.assertTrue(result["codeownersFileOnBaseBranch"])
        self.assertEqual(result["codeownersCandidateAssignmentLines"], 0)
        self.assertFalse(result["codeownersCoverageVerified"])

    def test_matching_base_head_and_number_are_mandatory(self):
        variants = (
            {**pr(), "number": 27},
            {**pr(), "state": "closed"},
            {**pr(), "draft": 1},
            {**pr(), "head": {"sha": BASE_SHA}},
            {**pr(), "base": {"ref": BASE, "sha": HEAD,
                              "repo": {"full_name": REPO}}},
            {**pr(), "base": {"ref": "main", "sha": BASE_SHA,
                              "repo": {"full_name": REPO}}},
            {**pr(), "base": {"ref": BASE, "sha": BASE_SHA,
                              "repo": {"full_name": 12}}},
        )
        for bad in variants:
            with self.subTest(number=bad.get("number")):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_BASE_POLICY_AUDIT_REFUSED$"):
                    audit(pr_info=bad)

    def test_moved_branch_and_invalid_protected_flag_refuse(self):
        for modified in (
            {"name": BASE, "commit": {"sha": HEAD}, "protected": True},
            {"name": BASE, "commit": {"sha": BASE_SHA}, "protected": 1},
            {"name": "main", "commit": {"sha": BASE_SHA},
             "protected": False},
        ):
            with self.assertRaisesRegex(
                    ValueError, "^CONTROLLED_BASE_POLICY_AUDIT_REFUSED$"):
                audit(branch_info=modified)

    def test_malformed_rules_must_not_be_published(self):
        for bad in (
            [rule(approvals=True)],
            [rule(approvals=-1)],
            [rule(approvals=99)],
            [rule(require_codeowners="true")],
            [{"type": "pull_request"}],
            [{"type": None}],
            [{"type": "private-file-path" * 20}],
            [{"type": "creation"}] * (MAX_RULES + 1),
        ):
            with self.subTest(length=len(bad)):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_BASE_POLICY_AUDIT_REFUSED$"):
                    audit(rules=bad)

    def test_malformed_and_oversized_codeowner_file_refuse(self):
        for bad in (
            owners(github="*.py @alice"),
            owners(github=b"x" * 128_001),
            owners(github=b"\xff\xfefd"),
            {"github": None},
        ):
            with self.assertRaisesRegex(
                    ValueError, "^CONTROLLED_BASE_POLICY_AUDIT_REFUSED$"):
                audit(codeowners=bad)

    def test_live_query_uses_pinned_base_sha_and_actual_endpoint(self):
        called = []
        def fake_api(token, path, allow_missing=False):
            self.assertEqual(token, TOKEN)
            called.append((path, allow_missing))
            if path.endswith("/pulls/26"):
                return pr()
            if "/branches/" in path and "/rules/" not in path:
                return branch()
            if "/rules/branches/" in path:
                return [rule(1), {"type": "required_status_checks"}]
            if "/contents/.github/CODEOWNERS?" in path:
                raw = b"*.py @dev\n"
                return {"type": "file", "encoding": "base64",
                        "size": len(raw),
                        "content": base64.b64encode(raw).decode()}
            if "/contents/" in path:
                return None
            raise AssertionError("unexpected path")
        with patch("controlled_base_policy_audit._api_json", side_effect=fake_api):
            result = query_base_branch_policy(REPO, 26, HEAD, BASE, BASE_SHA, TOKEN)
        self.assertEqual(len(called), 6)
        self.assertTrue(result["codeownersFileOnBaseBranch"])
        self.assertTrue(result["activeCodeownerReviewRuleObserved"])
        self.assertTrue(all((not maybe or ("?ref=" + BASE_SHA) in path)
                            for path, maybe in called))
        self.assert_not_approved(result)

    def test_invalid_live_repo_branch_sha_or_token_refuse_before_network(self):
        for details in (
            ("fake/../hack", 26, HEAD, BASE, BASE_SHA, TOKEN),
            (REPO, True, HEAD, BASE, BASE_SHA, TOKEN),
            (REPO, 26, "bad", BASE, BASE_SHA, TOKEN),
            (REPO, 26, HEAD, "../outside", BASE_SHA, TOKEN),
            (REPO, 26, HEAD, BASE, "fake", TOKEN),
            (REPO, 26, HEAD, BASE, BASE_SHA, "short"),
        ):
            with self.assertRaisesRegex(
                    ValueError, "^CONTROLLED_BASE_POLICY_AUDIT_REFUSED$"):
                query_base_branch_policy(*details)

    def test_invalid_github_base64_metadata_refused(self):
        for response in (
            {"type": "file", "encoding": "utf-8", "size": 4,
             "content": "test"},
            {"type": "file", "encoding": "base64", "size": 9,
             "content": "ZGF0YQ=="},
            {"type": "file", "encoding": "base64", "size": 1,
             "content": "<PRIVATE>"},
            {"type": "dir", "encoding": "base64", "size": 4,
             "content": "ZGF0YQ=="},
        ):
            with self.assertRaisesRegex(
                    ValueError, "^CONTROLLED_BASE_POLICY_AUDIT_REFUSED$"):
                _owners_bytes(response)

    def test_no_private_rule_source_owner_or_sha_in_output(self):
        result = audit(
            rules=[{**rule(), "ruleset_source": "privateOrg/secret",
                    "ruleset_id": 77}],
            codeowners=owners(github=b"secret/*.py @secret-team\n"))
        published = json.dumps(result)
        for forbidden in ("privateOrg", "secret-team", BASE, HEAD,
                          BASE_SHA, "secret/*.py", "test-owner"):
            self.assertNotIn(forbidden, published)
        self.assert_not_approved(result)


if __name__ == "__main__":
    unittest.main()
