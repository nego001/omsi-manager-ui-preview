"""M18: bounded regression comparison for the SAME CI-generated ZIP fixture.

This is a test-only, in-memory contract. Snapshot digests are PRIVATE
comparison guards, not signatures or evidence of origin. A difference is
REVIEW_REQUIRED, never automatically declared a bug or a valid mod.
No real archives, files, filesystem, network, IPC or installations.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib

from controlled_fixture_game_hints import assess_controlled_zip_game_hints
from controlled_fixture_decision_trace import RULES, RULE_IDS, ASSESSMENTS
from controlled_o3d_header_hints import O3D_HEADER_CLASSES
from controlled_o3d_vertex_hints import O3D_VERTEX_HINT_CLASSES
from controlled_o3d_triangle_hints import O3D_TRIANGLE_HINT_CLASSES
from controlled_o3d_material_hints import O3D_MATERIAL_HINT_CLASSES
from controlled_o3d_matrix_hints import O3D_MATRIX_HINT_CLASSES
from controlled_o3d_bone_hints import O3D_BONE_HINT_CLASSES
from controlled_o3d_evidence_coordinator import O3D_EVIDENCE_STATES
from controlled_zip_reader import MAX_ARCHIVE_BYTES

SCHEMA = "synthetic-fixture-regression-contract-v1"
GROUPS = (
    "assessment",
    "selectedRule",
    "orderedRuleOutcomes",
    "linkedVariantCounters",
    "o3dStructuralHintCounts",
    "o3dEvidenceStateCounts",
    "safetyInvariants",
)
COUNTER_FIELDS = (
    "omsiPairedVehicleFolderCount",
    "omsiLinkedVehicleFolderCount",
    "omsiMeshLinkedVehicleFolderCount",
    "omsiPlausibleO3dHeaderLinkedVehicleFolderCount",
    "omsiMeshLinkedWithoutPlausibleHeaderFolderCount",
    "omsiBoundedVertexHintLinkedVehicleFolderCount",
    "omsiMeshLinkedWithoutBoundedVertexHintFolderCount",
    "omsiBoundedTriangleHintLinkedVehicleFolderCount",
    "omsiMeshLinkedWithoutBoundedTriangleHintFolderCount",
    "omsiBoundedMaterialHintLinkedVehicleFolderCount",
    "omsiMeshLinkedWithoutBoundedMaterialHintFolderCount",
    "omsiBoundedMatrixHintLinkedVehicleFolderCount",
    "omsiMeshLinkedWithoutBoundedMatrixHintFolderCount",
    "omsiBoundedBoneHintLinkedVehicleFolderCount",
    "omsiMeshLinkedWithoutBoundedBoneHintFolderCount",
    "omsiOptionalBoneAbsentLinkedVehicleFolderCount",
    "omsiLinkedWithoutMeshFolderCount",
    "omsiUnlinkedPairedFolderCount",
    "omsiBusMarkerFolderCount",
    "omsiCfgMarkerFolderCount",
    "truckSiiMarkerCount",
)
HINT_TABLES = (
    ("o3dHeaderHintCounts", O3D_HEADER_CLASSES),
    ("o3dVertexSectionHintCounts", O3D_VERTEX_HINT_CLASSES),
    ("o3dTriangleIndexHintCounts", O3D_TRIANGLE_HINT_CLASSES),
    ("o3dMaterialReferenceHintCounts", O3D_MATERIAL_HINT_CLASSES),
    ("o3dMatrixSectionHintCounts", O3D_MATRIX_HINT_CLASSES),
    ("o3dBoneWeightHintCounts", O3D_BONE_HINT_CLASSES),
)
GUARD_FALSE_FIELDS = (
    "syntheticScopeIsAuthenticatedOrigin",
    "syntheticEvidenceIsRealFormatProof",
    "meshFormatVerified",
    "evidenceAuthenticated",
    "gameRecognized",
    "realModInspected",
    "compatibilityVerified",
    "installationEnabled",
    "realGameFilesTouched",
)
TRACE_GUARD_FALSE_FIELDS = (
    "realGameIdentityEstablished",
    "realFormatValidated",
    "compatibilityEstablished",
    "installationAuthorized",
)
ALLOWED_OUTCOMES = frozenset(("selected", "matchedButOverridden", "notMatched"))


@dataclass(frozen=True, slots=True)
class SyntheticFixtureSnapshot:
    # Private: never serialize or log the digest or this whole object.
    fixture_digest: bytes
    groups: tuple[tuple[str, object], ...]


def _refuse():
    raise ValueError("CONTROLLED_FIXTURE_REGRESSION_REFUSED")


def _valid_snapshot(snapshot: SyntheticFixtureSnapshot) -> bool:
    if (type(snapshot) is not SyntheticFixtureSnapshot or
            type(snapshot.fixture_digest) is not bytes or
            len(snapshot.fixture_digest) != 32 or
            type(snapshot.groups) is not tuple or
            len(snapshot.groups) != len(GROUPS) or
            any(type(pair) is not tuple or len(pair) != 2 or pair[0] != name
                for pair, name in zip(snapshot.groups, GROUPS))):
        return False
    _, assessment = snapshot.groups[0]
    _, rule = snapshot.groups[1]
    _, outcomes = snapshot.groups[2]
    _, counters = snapshot.groups[3]
    _, hints = snapshot.groups[4]
    _, states = snapshot.groups[5]
    _, guards = snapshot.groups[6]
    expected_rules = {row[0]: row[1] for row in RULES}
    if (type(assessment) is not str or assessment not in ASSESSMENTS or
            type(rule) is not str or expected_rules.get(rule) != assessment or
            type(outcomes) is not tuple or len(outcomes) != len(RULE_IDS) or
            any(type(v) is not str or v not in ALLOWED_OUTCOMES
                for v in outcomes) or outcomes.count("selected") != 1 or
            outcomes[RULE_IDS.index(rule)] != "selected"):
        return False
    if (type(counters) is not tuple or len(counters) != len(COUNTER_FIELDS) or
            any(type(v) is not int or v < 0 for v in counters)):
        return False
    if (type(hints) is not tuple or len(hints) != len(HINT_TABLES) or
            any(type(row) is not tuple or len(row) != len(classes) or
                any(type(v) is not int or v < 0 for v in row)
                for row, (_, classes) in zip(hints, HINT_TABLES))):
        return False
    if (type(states) is not tuple or len(states) != len(O3D_EVIDENCE_STATES)
            or any(type(v) is not int or v < 0 for v in states)):
        return False
    if (type(guards) is not tuple or
            len(guards) != len(GUARD_FALSE_FIELDS) + len(TRACE_GUARD_FALSE_FIELDS)
            or any(v is not False for v in guards)):
        return False
    return True


def capture_synthetic_fixture_snapshot(payload: bytes) -> SyntheticFixtureSnapshot:
    """Re-run existing read-only classifiers; build a private immutable baseline.

    The caller must construct the ZIP in memory specifically for the CI test.
    """
    if (type(payload) is not bytes or
            not (0 < len(payload) <= MAX_ARCHIVE_BYTES)):
        _refuse()
    report = assess_controlled_zip_game_hints(payload)
    try:
        trace = report["syntheticDecisionTrace"]
        if (report["syntheticScopeConsistencyChecked"] is not True or
                trace["schema"] != "synthetic-fixture-decision-trace-v1" or
                trace["aggregateO3dStatesCannotPromoteDecision"] is not True or
                trace["decisionDerivedFromLinkedFixtureMarkersOnly"] is not True):
            _refuse()
        rule_rows = trace["orderedRuleOutcomes"]
        if (type(rule_rows) not in (tuple, list) or
                len(rule_rows) != len(RULE_IDS) or
                any(type(row) is not dict or
                    row.get("ruleId") != expected or
                    type(row.get("outcome")) is not str
                    for row, expected in zip(rule_rows, RULE_IDS))):
            _refuse()
        groups = (
            ("assessment", report["assessment"]),
            ("selectedRule", trace["selectedRuleId"]),
            ("orderedRuleOutcomes", tuple(row["outcome"] for row in rule_rows)),
            ("linkedVariantCounters", tuple(report[key] for key in COUNTER_FIELDS)),
            ("o3dStructuralHintCounts", tuple(
                tuple(report[name][code] for code in classes)
                for name, classes in HINT_TABLES)),
            ("o3dEvidenceStateCounts", tuple(
                report["o3dSyntheticEvidenceStateCounts"][name]
                for name in O3D_EVIDENCE_STATES)),
            ("safetyInvariants", tuple(
                report[name] for name in GUARD_FALSE_FIELDS) + tuple(
                trace[name] for name in TRACE_GUARD_FALSE_FIELDS)),
        )
    except (KeyError, TypeError, IndexError):
        _refuse()
    snapshot = SyntheticFixtureSnapshot(
        hashlib.sha256(payload).digest(), groups)
    if not _valid_snapshot(snapshot):
        _refuse()
    return snapshot


def compare_synthetic_fixture_snapshots(
        baseline: SyntheticFixtureSnapshot,
        candidate: SyntheticFixtureSnapshot) -> dict:
    """Compare SAME ZIP bytes across two versions; any drift needs human review.

    This neither signs/approves a baseline nor claims that differences are
    regressions. Changing the ZIP itself is an incomparable experiment.
    """
    if (not _valid_snapshot(baseline) or not _valid_snapshot(candidate) or
            baseline.fixture_digest != candidate.fixture_digest):
        _refuse()
    changed = tuple(
        group for (group, before), (_, after)
        in zip(baseline.groups, candidate.groups) if before != after
    )
    return {
        "schema": SCHEMA,
        "comparison": "reviewRequired" if changed else "stable",
        "changedContractGroups": changed,
        "sameSyntheticZipBytesCompared": True,
        "changeIsAutomaticallyProvenRegression": False,
        "baselineAuthenticityEstablished": False,
        "realModValidated": False,
        "installationAuthorized": False,
    }
