"""M17: deterministic, privacy-safe decision trace for CI-created ZIP fixtures.

The trace explains only the already-established TEST-FIXTURE assessment.
It does NOT identify a real simulator, validate a model or authorize install.
Only sealed rules and fixed messages are returned; no user-supplied strings,
paths, hashes, data, archive names or timestamps leave this module.
"""
from __future__ import annotations

SUMMARY_FIELDS = (
    "paired", "linked", "meshLinked", "bus", "cfg", "truck"
)

# The order exactly mirrors controlled_fixture_game_hints.py.
RULES = (
    ("mixedMarkers", "mixed-markers-ambiguous",
     "BUS/CFG markers coexist with shared SII markers in the test ZIP."),
    ("linkedMesh", "omsi-fixture-candidate",
     "A synthetic BUS references a marked CFG that references an O3D in the same variant."),
    ("linkedModelWithoutMesh", "omsi-model-mesh-unconfirmed",
     "A BUS-to-CFG reference exists, but its mesh target was not established."),
    ("sharedSii", "ets2-ats-shared-format-ambiguous",
     "Shared SII markers do not distinguish ETS2 from ATS."),
    ("pairedWithoutLink", "unlinked-omsi-fixture-markers",
     "Marked BUS and CFG entries share a variant without a confirmed reference."),
    ("isolatedOmSiMarker", "insufficient-omsi-fixture-evidence",
     "Only partial BUS/CFG fixture markers were observed."),
    ("noRecognizableMarkers", "no-recognizable-fixture-evidence",
     "No supported synthetic game-definition markers were observed."),
)

RULE_IDS = tuple(item[0] for item in RULES)
ASSESSMENTS = frozenset(item[1] for item in RULES)


def _refuse() -> None:
    raise ValueError("CONTROLLED_FIXTURE_DECISION_TRACE_REFUSED")


def explain_controlled_fixture_decision(
        assessment: str, counters: dict[str, int],
        scope_consistency_checked: bool) -> dict:
    """Independently replay the seven ordered synthetic decision rules.

    Returns a static-size trace with bounded fixed strings; must be
    invoked only after the M16 internal ZIP-scope audit has passed.
    """
    if (type(assessment) is not str or assessment not in ASSESSMENTS
            or scope_consistency_checked is not True
            or type(counters) is not dict
            or set(counters) != set(SUMMARY_FIELDS)
            or any(type(value) is not int or value < 0
                   for value in counters.values())):
        _refuse()

    paired, linked, mesh, bus, cfg, truck = (
        counters[key] for key in SUMMARY_FIELDS
    )
    if not (mesh <= linked <= paired <= min(bus, cfg)):
        _refuse()

    matches = (
        (bool(paired or linked) and bool(truck)),
        bool(mesh),
        bool(linked) and not bool(mesh),
        bool(truck),
        bool(paired) and not bool(linked),
        bool(bus or cfg) and not bool(paired) and not bool(truck),
        not bool(bus or cfg or truck),
    )
    selected = next(i for i, value in enumerate(matches) if value)
    if RULES[selected][1] != assessment:
        # Inconsistent decision inputs must not produce a misleading trace.
        _refuse()

    ordered = tuple(
        {
            "ruleId": rule_id,
            "outcome": ("selected" if i == selected else
                        "matchedButOverridden" if matched else "notMatched"),
        }
        for i, ((rule_id, _, _), matched) in enumerate(zip(RULES, matches))
    )
    return {
        "schema": "synthetic-fixture-decision-trace-v1",
        "selectedRuleId": RULES[selected][0],
        "selectedReason": RULES[selected][2],
        "orderedRuleOutcomes": ordered,
        "decisionDerivedFromLinkedFixtureMarkersOnly": True,
        "aggregateO3dStatesCannotPromoteDecision": True,
        "realGameIdentityEstablished": False,
        "realFormatValidated": False,
        "compatibilityEstablished": False,
        "installationAuthorized": False,
    }
