"""M23: no-network tests for advisory-only default-branch rollout."""
import base64
import json
import unittest
from unittest.mock import patch

from controlled_default_branch_rollout import (
    ADVISORY_FIELDS_ALWAYS_FALSE, PHASES, SCHEMA,
    assess_default_branch_rollout, query_live_default_branch_plan,
)

REPO = "test-owner/synthetic-repo"
SHA = "a" * 40
TOKEN = "FAKE_GITHUB_TOKEN_FOR_TESTS_0123456789"


def repo_meta(default="main", archived=False):
    return {"full_name": REPO, "default_branch": default,
            "private": False, "archived": archived}


def branch(default="main", protected=False, sha=SHA):
    return {"name": default, "protected": protected, "commit": {"sha": sha}}


def owners(**provided):
    result = {"github": None, "root": None, "docs": None}
    result.update(provided)
    return result


def rule(reviews=1, codeowners=True):
    return {"type": "pull_request", "parameters": {
        "required_approving_review_count": reviews,
        "require_code_owner_review": codeowners,
    }}


def plan(meta=None, branch_info=None, rules=None, codeowners=None):
    return assess_default_branch_rollout(
        repo_meta() if meta is None else meta,
        branch() if branch_info is None else branch_info,
        [] if rules is None else rules,
        owners() if codeowners is None else codeowners,
        REPO,
    )


class DefaultBranchRolloutPlanTests(unittest.TestCase):
    def assert_safe(self, report):
        self.assertEqual(report["schema"], SCHEMA)
        self.assertEqual(report["planMode"], "advisoryOnly")
        self.assertTrue(report["repositoryDefaultBranchMatched"])
        self.assertEqual(report["proposedPhaseIds"], list(PHASES))
        self.assertEqual(report["selectedRequiredCheckContexts"], [])
        self.assertFalse(report["independentReviewerLoginProposed"])
        self.assertFalse(report["classicProtectionDetailsVerified"])
        self.assertFalse(report["allEffectiveRuleSourcesVerified"])
        for field in ADVISORY_FIELDS_ALWAYS_FALSE:
            self.assertIs(report[field], False)

    def test_main_unprotected_without_codeowners_is_not_ready(self):
        result = plan()
        self.assertEqual(result["defaultBranchName"], "main")
        self.assertEqual(result["rolloutStatus"],
                         "needsVerifiedIndependentCodeowner")
        self.assertFalse(result["branchProtectedFlagReported"])
        self.assertEqual(result["activeRulesReported"], 0)
        self.assertFalse(result["codeownersPresentOnDefaultBranch"])
        self.assert_safe(result)

    def test_existing_codeowners_but_no_rules_needs_manual_protection_design(self):
        result = plan(codeowners=owners(github=b"*.py @verified-reviewer\n"))
        self.assertEqual(result["rolloutStatus"], "needsManualProtectionDesign")
        self.assertTrue(result["codeownersPresentOnDefaultBranch"])
        self.assertEqual(result["codeownersSourceCategory"], "github")
        self.assertEqual(result["codeownersCandidateAssignmentLines"], 1)
        self.assert_safe(result)

    def test_existing_rules_and_owners_still_not_approval(self):
        result = plan(branch_info=branch(protected=True),
                      rules=[rule(2), {"type": "required_status_checks"}],
                      codeowners=owners(root=b"/src/ @reviewer\n"))
        self.assertEqual(result["rolloutStatus"],
                         "existingControlsRequireManualReview")
        self.assertEqual(result["activeRulesReported"], 2)
        self.assertEqual(result["activePullRequestRulesReported"], 1)
        self.assertEqual(result["activeStatusCheckRulesReported"], 1)
        self.assertEqual(result["codeownerReviewRulesObserved"], 1)
        self.assertEqual(result["maximumReviewCountObserved"], 2)
        self.assert_safe(result)

    def test_codeowners_precedence_and_private_contents_not_exposed(self):
        result = plan(codeowners=owners(
            github=b"# private-team\n*.py @private1\n*.md @private2\n",
            root=b"* @root\n", docs=b"* @docs\n"))
        self.assertEqual(result["codeownersSourceCategory"], "github")
        self.assertEqual(result["codeownersCandidateAssignmentLines"], 2)
        dumped = json.dumps(result)
        for private in ("@private1", "@private2", "private-team",
                        "test-owner", SHA, "token", "*.py"):
            self.assertNotIn(private, dumped)
        self.assert_safe(result)

    def test_default_branch_can_be_other_than_main_only_if_both_agree(self):
        result = plan(meta=repo_meta("release/dev"),
                      branch_info=branch("release/dev"))
        self.assertEqual(result["defaultBranchName"], "release/dev")
        self.assertEqual(result["defaultBranchScope"],
                         "repositoryDefaultBranch")
        self.assert_safe(result)

    def test_wrong_repository_moved_default_branch_or_archived_repo_refused(self):
        for m,b in (
            (repo_meta("main"), branch("release")),
            (repo_meta(archived=True), branch()),
            ({**repo_meta(), "full_name": "other-owner/other-repo"}, branch()),
            ({**repo_meta(), "private": "false"}, branch()),
            ({**repo_meta(), "default_branch": "../secret"}, branch()),
            (repo_meta(), branch(sha="wrong")),
            (repo_meta(), {**branch(), "protected": 1}),
        ):
            with self.subTest(meta=m, branch=b):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_DEFAULT_BRANCH_PLAN_REFUSED$"):
                    plan(meta=m, branch_info=b)

    def test_wrong_rules_and_forged_check_settings_refused(self):
        cases = (
            [rule(True)],
            [rule(-1)],
            [rule(51)],
            [rule(codeowners="true")],
            [{"type": "pull_request"}],
            [{"type": 5}],
            [{"type": "other"}] * 100,
        )
        for value in cases:
            with self.subTest(count=len(value)):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_DEFAULT_BRANCH_PLAN_REFUSED$"):
                    plan(rules=value)

    def test_invalid_or_oversize_codeowners_refused_without_echo(self):
        for value in (
            owners(github="*.py @fake"),
            owners(github=b"x" * 128_001),
            owners(github=b"\xff\xfe\xff"),
            {"root": None},
        ):
            with self.subTest(value_type=type(value.get("github")).__name__):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_DEFAULT_BRANCH_PLAN_REFUSED$"):
                    plan(codeowners=value)

    def test_commented_or_empty_codeowners_is_not_coverage_proof(self):
        result = plan(codeowners=owners(github=b"# just a comment\n  \n"))
        self.assertEqual(result["codeownersCandidateAssignmentLines"], 0)
        self.assertFalse(result["codeownerApprovalSatisfied"])
        self.assertFalse(result["requiredStatusChecksSatisfied"])
        self.assert_safe(result)

    def test_live_api_reads_default_branch_and_codeowners_pinned_to_sha(self):
        paths = []
        def fake_api(_token, path, allow_missing=False):
            self.assertEqual(_token, TOKEN)
            paths.append((path, allow_missing))
            if path == "repos/" + REPO:
                return repo_meta()
            if path.endswith("/branches/main"):
                return branch()
            if "/rules/branches/main?" in path:
                return []
            if "/contents/.github/CODEOWNERS?" in path:
                raw = b"*.py @someone\n"
                return {"type": "file", "size": len(raw), "encoding": "base64",
                        "content": base64.b64encode(raw).decode()}
            if "/contents/" in path:
                return None
            raise AssertionError("unexpected API endpoint")
        with patch("controlled_default_branch_rollout._api_json",
                   side_effect=fake_api):
            result = query_live_default_branch_plan(REPO, TOKEN)
        self.assertEqual(len(paths), 6)
        for path, missing in paths:
            if missing:
                self.assertIn("?ref=" + SHA, path)
        self.assertTrue(result["codeownersPresentOnDefaultBranch"])
        self.assert_safe(result)

    def test_invalid_repo_path_token_and_unknown_api_data_refuse(self):
        for repo, token in (
            ("test-owner/../secret", TOKEN),
            ("https://github.com/test-owner/repo", TOKEN),
            ("test-owner/", TOKEN),
            (REPO, "short"),
        ):
            with self.subTest(repo=repo):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_DEFAULT_BRANCH_PLAN_REFUSED$"):
                    query_live_default_branch_plan(repo, token)
        with patch("controlled_default_branch_rollout._api_json",
                   return_value={"default_branch": "main"}):
            with self.assertRaisesRegex(
                    ValueError, "^CONTROLLED_DEFAULT_BRANCH_PLAN_REFUSED$"):
                query_live_default_branch_plan(REPO, TOKEN)

    def test_no_auto_codeowner_file_or_policy_enforcement_generated(self):
        result = plan()
        self.assertFalse(result["proposedCodeownersActivated"])
        self.assertFalse(result["branchProtectionEnforcedByThisPlan"])
        self.assertFalse(result["mergeAllowed"])
        self.assertFalse(result["ubuntu24StrictSandboxWaived"])
        self.assertFalse(result["installationAuthorized"])
        self.assertFalse(result["reviewerIdentityVerified"])
        self.assert_safe(result)


if __name__ == "__main__":
    unittest.main()
