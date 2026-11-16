"""M20: manual-review policy for two-revision SYNTHETIC CI fixture drift.

A source-controlled change declaration is merely an intent to request review,
NOT evidence of a code review or approval. No auto-approval/waiver exists.
The comparison uses only sealed, sanitized M19 group names and counters.
Never handles actual mods, user paths, public hashes or game installations.
"""
from __future__ import annotations

from dataclasses import dataclass

from controlled_fixture_regression_guard import GROUPS

POLICY_SCHEMA = "synthetic-contract-human-review-policy-v1"
EXPECTED_M19_SCHEMA = "synthetic-two-revision-comparison-v1"
FIXED_BASELINE_M18 = "c260b0b5e6325c44766788a528e8a2aee8237333"
SYNTHETIC_FIXTURE_COUNT = 9
REVIEW_ISSUE = 2
REVIEWABLE_GROUPS = tuple(group for group in GROUPS
                          if group != "safetyInvariants")
REASON_CODES = (
    "classification-rule-adjustment",
    "reference-linking-correction",
    "bounded-o3d-hints-revision",
    "multi-stage-contract-refactor",
)
CLASSIFICATION_GROUPS = frozenset(
    ("assessment", "selectedRule", "orderedRuleOutcomes"))
LINK_GROUPS = frozenset(("linkedVariantCounters",))
O3D_GROUPS = frozenset(("o3dStructuralHintCounts", "o3dEvidenceStateCounts"))
M19_FIELDS = frozenset((
    "schema", "comparison", "syntheticFixturesCompared",
    "stableSyntheticFixtures", "changedContractGroups",
    "twoIndependentRevisionProcessesUsed", "sameSyntheticZipBytesCompared",
    "baselineAuthenticityEstablished", "changeIsAutomaticallyProvenRegression",
    "realModValidated", "installationAuthorized",
))


@dataclass(frozen=True, slots=True)
class ContractChangeDeclaration:
    """Proposal metadata, never an approval or a permission.

    A reviewer must inspect the PR, fixture evidence, and issue externally.
    """
    baseline_commit_sha: str
    affected_groups: tuple[str, ...]
    reason_code: str
    review_issue: int


# CI intentionally has NO change declaration by default. Future proposed
# declarations require a separately reviewed source-code change and do not
# change the fail-on-drift outcome of the M19 job.
CI_CHANGE_DECLARATION: ContractChangeDeclaration | None = None


def _refuse() -> None:
    raise ValueError("CONTROLLED_CONTRACT_REVIEW_REFUSED")


def _validated_summary(summary: dict) -> tuple[str, tuple[str, ...]]:
    if type(summary) is not dict or set(summary) != M19_FIELDS:
        _refuse()
    if (summary["schema"] != EXPECTED_M19_SCHEMA or
            summary["twoIndependentRevisionProcessesUsed"] is not True or
            summary["sameSyntheticZipBytesCompared"] is not True or
            any(summary[key] is not False for key in (
                "baselineAuthenticityEstablished",
                "changeIsAutomaticallyProvenRegression",
                "realModValidated", "installationAuthorized"))):
        _refuse()
    if (type(summary["syntheticFixturesCompared"]) is not int or
            summary["syntheticFixturesCompared"] != SYNTHETIC_FIXTURE_COUNT or
            type(summary["stableSyntheticFixtures"]) is not int or
            not (0 <= summary["stableSyntheticFixtures"] <= SYNTHETIC_FIXTURE_COUNT)):
        _refuse()
    changed = summary["changedContractGroups"]
    if (type(changed) is not list or
            any(type(group) is not str or group not in GROUPS
                for group in changed) or
            changed != sorted(set(changed))):
        _refuse()
    comparison = summary["comparison"]
    if comparison == "stable":
        if changed or summary["stableSyntheticFixtures"] != SYNTHETIC_FIXTURE_COUNT:
            _refuse()
    elif comparison == "reviewRequired":
        if (not changed or
                summary["stableSyntheticFixtures"] >= SYNTHETIC_FIXTURE_COUNT):
            _refuse()
    else:
        _refuse()
    return comparison, tuple(changed)


def _validate_declaration(
        declaration: ContractChangeDeclaration,
        changed: tuple[str, ...]) -> None:
    if (type(declaration) is not ContractChangeDeclaration or
            declaration.baseline_commit_sha != FIXED_BASELINE_M18 or
            type(declaration.affected_groups) is not tuple or
            not declaration.affected_groups or
            any(type(group) is not str or group not in REVIEWABLE_GROUPS
                for group in declaration.affected_groups) or
            declaration.affected_groups != tuple(sorted(set(declaration.affected_groups))) or
            declaration.affected_groups != changed or
            type(declaration.reason_code) is not str or
            declaration.reason_code not in REASON_CODES or
            type(declaration.review_issue) is not int or
            declaration.review_issue != REVIEW_ISSUE):
        _refuse()
    selected = set(changed)
    reason = declaration.reason_code
    if (reason == "classification-rule-adjustment"
            and not selected <= CLASSIFICATION_GROUPS):
        _refuse()
    if (reason == "reference-linking-correction"
            and not selected <= LINK_GROUPS):
        _refuse()
    if (reason == "bounded-o3d-hints-revision"
            and not selected <= O3D_GROUPS):
        _refuse()
    if reason == "multi-stage-contract-refactor":
        # Only cross-category changes should use the broad reason label.
        categories = sum(bool(selected & category) for category in (
            CLASSIFICATION_GROUPS, LINK_GROUPS, O3D_GROUPS))
        if categories < 2:
            _refuse()


def evaluate_synthetic_change_review(
        summary: dict,
        declaration: ContractChangeDeclaration | None = None) -> dict:
    """Explain a drift for a human; never waive CI/release safety.

    The only CI-pass state is when all 9 comparisons are stable and no
    declaration is present. Source-controlled intent does not grant consent.
    """
    comparison, changed = _validated_summary(summary)
    if comparison == "stable":
        if declaration is not None:
            # A stale or speculative approval claim must not be attached to
            # unchanged evidence.
            _refuse()
        status = "stableNoReviewRequested"
    elif "safetyInvariants" in changed:
        # Security invariants cannot be declared/waived as planned changes.
        _refuse()
    elif declaration is None:
        status = "unexpectedDriftNeedsReview"
    else:
        _validate_declaration(declaration, changed)
        status = "declaredIntentStillNeedsHumanReview"

    return {
        "schema": POLICY_SCHEMA,
        "reviewStatus": status,
        "changedContractGroups": list(changed),
        "changeIntentDeclared": status == "declaredIntentStillNeedsHumanReview",
        "humanReviewStillRequired": comparison != "stable",
        "ciPassAllowed": comparison == "stable",
        "humanApprovalVerified": False,
        "baselineReapprovedAutomatically": False,
        "pullRequestAutoMergeAllowed": False,
        "ubuntu24StrictSandboxGateWaived": False,
        "realModValidated": False,
        "installationAuthorized": False,
    }
