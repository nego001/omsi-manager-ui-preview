"""M20 fail-closed human-review policy tests. CI fixtures only; no mod access."""
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch
import json
import unittest

from controlled_fixture_review_policy import (
    CI_CHANGE_DECLARATION, FIXED_BASELINE_M18, M19_FIELDS,
    POLICY_SCHEMA, ContractChangeDeclaration,
    evaluate_synthetic_change_review,
)
from controlled_ci_revision_diff import (
    ci_synthetic_fixtures, run_ci_two_revision_comparison,
)
from controlled_fixture_regression_guard import (
    capture_synthetic_fixture_snapshot,
)


def fixture_summary(changed=(), stable=9):
    changes = sorted(changed)
    return {
        "schema": "synthetic-two-revision-comparison-v1",
        "comparison": "reviewRequired" if changes else "stable",
        "syntheticFixturesCompared": 9,
        "stableSyntheticFixtures": stable,
        "changedContractGroups": changes,
        "twoIndependentRevisionProcessesUsed": True,
        "sameSyntheticZipBytesCompared": True,
        "baselineAuthenticityEstablished": False,
        "changeIsAutomaticallyProvenRegression": False,
        "realModValidated": False,
        "installationAuthorized": False,
    }


def proposed(groups, reason="classification-rule-adjustment",
             baseline=FIXED_BASELINE_M18, issue=2):
    return ContractChangeDeclaration(
        baseline_commit_sha=baseline,
        affected_groups=tuple(sorted(groups)),
        reason_code=reason,
        review_issue=issue,
    )


class ControlledFixtureReviewPolicyTests(unittest.TestCase):
    def assert_never_approves(self, output):
        for key in ("humanApprovalVerified", "baselineReapprovedAutomatically",
                    "pullRequestAutoMergeAllowed", "ubuntu24StrictSandboxGateWaived",
                    "realModValidated", "installationAuthorized"):
            self.assertIs(output[key], False)

    def test_stable_nine_fixtures_is_only_allowed_ci_pass(self):
        self.assertIsNone(CI_CHANGE_DECLARATION)
        summary = fixture_summary()
        self.assertEqual(set(summary), set(M19_FIELDS))
        output = evaluate_synthetic_change_review(summary)
        self.assertEqual(output["schema"], POLICY_SCHEMA)
        self.assertEqual(output["reviewStatus"], "stableNoReviewRequested")
        self.assertIs(output["ciPassAllowed"], True)
        self.assertIs(output["humanReviewStillRequired"], False)
        self.assertIs(output["changeIntentDeclared"], False)
        self.assert_never_approves(output)

    def test_unexpected_drift_requires_review_and_fails_ci(self):
        summary = fixture_summary(("selectedRule",), stable=8)
        output = evaluate_synthetic_change_review(summary)
        self.assertEqual(output["reviewStatus"], "unexpectedDriftNeedsReview")
        self.assertEqual(output["changedContractGroups"], ["selectedRule"])
        self.assertIs(output["ciPassAllowed"], False)
        self.assertIs(output["humanReviewStillRequired"], True)
        self.assertIs(output["changeIntentDeclared"], False)
        self.assert_never_approves(output)

    def test_intent_declared_is_not_human_approval_or_ci_waiver(self):
        groups = ("assessment", "orderedRuleOutcomes", "selectedRule")
        summary = fixture_summary(groups, stable=7)
        output = evaluate_synthetic_change_review(
            summary, proposed(groups))
        self.assertEqual(output["reviewStatus"], "declaredIntentStillNeedsHumanReview")
        self.assertIs(output["changeIntentDeclared"], True)
        self.assertIs(output["humanReviewStillRequired"], True)
        self.assertIs(output["ciPassAllowed"], False)
        self.assert_never_approves(output)

    def test_o3d_and_link_groups_require_narrow_reason_codes(self):
        samples = (
            (("linkedVariantCounters",), "reference-linking-correction"),
            (("o3dStructuralHintCounts", "o3dEvidenceStateCounts"),
             "bounded-o3d-hints-revision"),
            (("assessment", "linkedVariantCounters"),
             "multi-stage-contract-refactor"),
            (("selectedRule", "o3dStructuralHintCounts"),
             "multi-stage-contract-refactor"),
        )
        for groups, reason in samples:
            with self.subTest(groups=groups):
                output = evaluate_synthetic_change_review(
                    fixture_summary(groups, stable=8),
                    proposed(groups, reason=reason))
                self.assertEqual(
                    output["reviewStatus"], "declaredIntentStillNeedsHumanReview")
                self.assertIs(output["ciPassAllowed"], False)
                self.assert_never_approves(output)

    def test_stale_declaration_without_actual_change_is_refused(self):
        with self.assertRaisesRegex(
                ValueError, "^CONTROLLED_CONTRACT_REVIEW_REFUSED$"):
            evaluate_synthetic_change_review(
                fixture_summary(), proposed(("assessment",)))

    def test_unknown_or_unlisted_change_cannot_be_declared_approved(self):
        for groups, reason in (
            (("assessment", "selectedRule"), "reference-linking-correction"),
            (("linkedVariantCounters",), "classification-rule-adjustment"),
            (("o3dStructuralHintCounts",), "multi-stage-contract-refactor"),
            (("assessment", "safetyInvariants"), "multi-stage-contract-refactor"),
            (("assessment",), "arbitrary approvals granted"),
        ):
            with self.subTest(groups=groups, reason=reason):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_CONTRACT_REVIEW_REFUSED$"):
                    evaluate_synthetic_change_review(
                        fixture_summary(groups, stable=8),
                        proposed(groups, reason=reason))

    def test_changed_group_mismatch_and_wrong_baseline_issue_refused(self):
        original = fixture_summary(("assessment",), stable=8)
        cases = (
            proposed(("selectedRule",)),
            proposed(("assessment",), baseline="a" * 40),
            proposed(("assessment",), issue=77),
            proposed(("assessment",), issue=True),
        )
        for declaration in cases:
            with self.subTest(declaration=declaration.reason_code):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_CONTRACT_REVIEW_REFUSED$"):
                    evaluate_synthetic_change_review(original, declaration)

    def test_security_invariants_never_declared_and_never_waived(self):
        drift = fixture_summary(("safetyInvariants",), stable=8)
        for declaration in (None, proposed(
                ("safetyInvariants",), reason="multi-stage-contract-refactor")):
            with self.assertRaisesRegex(
                    ValueError, "^CONTROLLED_CONTRACT_REVIEW_REFUSED$"):
                evaluate_synthetic_change_review(drift, declaration)

    def test_malformed_summary_cannot_invent_green_result(self):
        stable = fixture_summary()
        edits = (
            {"syntheticFixturesCompared": 8},
            {"stableSyntheticFixtures": 8},
            {"stableSyntheticFixtures": True},
            {"changedContractGroups": ["assessment"]},
            {"schema": "private-mod-report"},
            {"twoIndependentRevisionProcessesUsed": 1},
            {"baselineAuthenticityEstablished": True},
            {"changeIsAutomaticallyProvenRegression": True},
            {"installationAuthorized": True},
            {"privateFileName": "secret.o3d"},
        )
        for update in edits:
            value = {**stable, **update}
            with self.subTest(field=next(iter(update))):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_CONTRACT_REVIEW_REFUSED$"):
                    evaluate_synthetic_change_review(value)

    def test_review_required_schema_mismatches_and_duplicate_groups_refused(self):
        variants = (
            fixture_summary((), stable=8),
            fixture_summary(("assessment",), stable=9),
            {**fixture_summary(("assessment",), stable=8),
             "changedContractGroups": ["selectedRule", "assessment"]},
            {**fixture_summary(("assessment",), stable=8),
             "changedContractGroups": ["assessment", "assessment"]},
            {**fixture_summary(("assessment",), stable=8),
             "changedContractGroups": ["PrivateVehicleName"]},
            {**fixture_summary(("assessment",), stable=8),
             "changedContractGroups": "assessment"},
        )
        for data in variants:
            with self.subTest(data=data["changedContractGroups"]):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_CONTRACT_REVIEW_REFUSED$"):
                    evaluate_synthetic_change_review(data)

    def test_forged_or_malformed_proposals_fail_with_constant_error(self):
        original = fixture_summary(("assessment",), stable=8)
        malformed = (
            {"approved": True, "groups": ["assessment"]},
            replace(proposed(("assessment",)), affected_groups=["assessment"]),
            replace(proposed(("assessment",)), affected_groups=(["assessment"],)),
            replace(proposed(("assessment",)), affected_groups=("assessment", "assessment")),
            replace(proposed(("assessment",)), affected_groups=("secret.o3d",)),
            replace(proposed(("assessment",)), reason_code=True),
            replace(proposed(("assessment",)), baseline_commit_sha=bytes(20)),
            replace(proposed(("assessment",)), review_issue="2"),
        )
        for item in malformed:
            with self.subTest(kind=type(item).__name__):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_CONTRACT_REVIEW_REFUSED$"):
                    evaluate_synthetic_change_review(original, item)

    def test_policy_output_is_fixed_and_never_discloses_private_values(self):
        data = fixture_summary(("o3dStructuralHintCounts",), stable=8)
        policy = evaluate_synthetic_change_review(
            data, proposed(("o3dStructuralHintCounts",),
                           reason="bounded-o3d-hints-revision"))
        serialized = json.dumps(policy, sort_keys=True)
        for private in ("Vehicles/", "private.o3d", "c260b0b5", "file_path",
                        "sha256", "token", "approvedBy", "review_issue"):
            self.assertNotIn(private, serialized)
        self.assert_never_approves(policy)

    def test_actual_m19_comparison_engine_emits_policy_for_stable_samples(self):
        # Mock only isolated OS process execution; reuse the actual M19 ZIP
        # construction, snapshot capture, comparator, and policy integration.
        samples = ci_synthetic_fixtures()
        private_snapshots = [
            capture_synthetic_fixture_snapshot(item) for item in samples]
        from controlled_ci_revision_diff import _probe_checkout
        with patch("controlled_ci_revision_diff._probe_checkout",
                   side_effect=[snap for snap in private_snapshots
                                for _ in range(2)]):
            output = run_ci_two_revision_comparison(
                Path("baseline/react-prototype/scripts"),
                Path("candidate/react-prototype/scripts"))
        self.assertEqual(output["syntheticFixturesCompared"], 9)
        self.assertEqual(output["stableSyntheticFixtures"], 9)
        self.assertEqual(output["comparison"], "stable")
        self.assertEqual(output["changeReviewPolicy"]["reviewStatus"],
                         "stableNoReviewRequested")
        self.assertIs(output["changeReviewPolicy"]["ciPassAllowed"], True)
        self.assert_never_approves(output["changeReviewPolicy"])

    def test_actual_m19_drift_path_stays_blocked_even_when_declared(self):
        samples = ci_synthetic_fixtures()
        reference = capture_synthetic_fixture_snapshot(samples[0])
        changed_groups = list(reference.groups)
        name, original_values = changed_groups[3]
        changed = list(original_values)
        changed[0] += 1
        changed_groups[3] = (name, tuple(changed))
        candidate = replace(reference, groups=tuple(changed_groups))
        def mock_probe(_path, fixture):
            # Both are valid snapshots for identical bytes in the first
            # test case. Remaining fixtures are stable.
            if fixture == samples[0]:
                mock_probe.calls += 1
                return reference if mock_probe.calls == 1 else candidate
            return capture_synthetic_fixture_snapshot(fixture)
        mock_probe.calls = 0
        with patch("controlled_ci_revision_diff._probe_checkout",
                   side_effect=mock_probe):
            output = run_ci_two_revision_comparison(
                Path("baseline/react-prototype/scripts"),
                Path("candidate/react-prototype/scripts"))
        self.assertEqual(output["comparison"], "reviewRequired")
        self.assertEqual(output["changedContractGroups"],
                         ["linkedVariantCounters"])
        self.assertEqual(output["changeReviewPolicy"]["reviewStatus"],
                         "unexpectedDriftNeedsReview")
        self.assertIs(output["changeReviewPolicy"]["ciPassAllowed"], False)


if __name__ == "__main__":
    unittest.main()
