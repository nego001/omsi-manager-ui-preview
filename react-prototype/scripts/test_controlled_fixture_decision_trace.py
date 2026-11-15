"""M17 adversarial decision-trace contracts using in-memory CI ZIP fixtures."""
import io
import json
import unittest
import zipfile

from controlled_fixture_decision_trace import (
    ASSESSMENTS, RULE_IDS, SUMMARY_FIELDS,
    explain_controlled_fixture_decision
)
from controlled_fixture_game_hints import assess_controlled_zip_game_hints

BASE = "Vehicles/PrivateVariantM17/"
BUS = b"[model]\nmodel/model.cfg\n"
CFG = b"[mesh]\nbody.o3d\n"
TRUCK = b"SiiNunit\n{\nvehicle : synthetic.truck\n}\n"


def package(entries):
    memory = io.BytesIO()
    with zipfile.ZipFile(memory, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, value in entries:
            archive.writestr(name, value)
    return assess_controlled_zip_game_hints(memory.getvalue())


def candidate(extra=()):
    return [
        (BASE + "Bus.bus", BUS),
        (BASE + "model/model.cfg", CFG),
        (BASE + "model/body.o3d", b"NOT_A_VERIFIED_O3D"),
        *extra
    ]


def counters(**kwargs):
    result = dict.fromkeys(SUMMARY_FIELDS, 0)
    result.update(kwargs)
    return result


class ControlledFixtureDecisionTraceTests(unittest.TestCase):
    def test_each_fixture_decision_has_exactly_one_stable_reason(self):
        fixtures = (
            (candidate(), "omsi-fixture-candidate", "linkedMesh"),
            (candidate((("def/truck.sii", TRUCK),)),
             "mixed-markers-ambiguous", "mixedMarkers"),
            (candidate()[:2], "omsi-model-mesh-unconfirmed",
             "linkedModelWithoutMesh"),
            ([(BASE + "Bus.bus", b"[model]\nmodel/missing.cfg\n"),
              (BASE + "model/model.cfg", CFG)],
             "unlinked-omsi-fixture-markers", "pairedWithoutLink"),
            ([(BASE + "Bus.bus", BUS)],
             "insufficient-omsi-fixture-evidence", "isolatedOmSiMarker"),
            ([("def/truck.sii", TRUCK)],
             "ets2-ats-shared-format-ambiguous", "sharedSii"),
            ([("notes.txt", b"private notes")],
             "no-recognizable-fixture-evidence", "noRecognizableMarkers"),
        )
        covered = set()
        for entries, expected_assessment, expected_rule in fixtures:
            with self.subTest(rule=expected_rule):
                result = package(entries)
                trace = result["syntheticDecisionTrace"]
                self.assertEqual(result["assessment"], expected_assessment)
                self.assertEqual(trace["selectedRuleId"], expected_rule)
                self.assertEqual(trace["schema"],
                                 "synthetic-fixture-decision-trace-v1")
                self.assertIn(expected_assessment, ASSESSMENTS)
                self.assertEqual(
                    [x["ruleId"] for x in trace["orderedRuleOutcomes"]],
                    list(RULE_IDS))
                self.assertEqual(sum(
                    x["outcome"] == "selected"
                    for x in trace["orderedRuleOutcomes"]), 1)
                self.assertTrue(trace["decisionDerivedFromLinkedFixtureMarkersOnly"])
                self.assertTrue(trace["aggregateO3dStatesCannotPromoteDecision"])
                self.assertTrue(result["syntheticScopeConsistencyChecked"])
                for flag in ("realGameIdentityEstablished", "realFormatValidated",
                             "compatibilityEstablished", "installationAuthorized"):
                    self.assertFalse(trace[flag])
                for flag in ("gameRecognized", "meshFormatVerified",
                             "compatibilityVerified", "installationEnabled",
                             "evidenceAuthenticated", "realModInspected"):
                    self.assertFalse(result[flag])
                covered.add(expected_rule)
        self.assertEqual(covered, set(RULE_IDS))

    def test_mixed_markers_precede_linked_mesh_and_shared_sii(self):
        result = package(candidate((("def/truck.sii", TRUCK),)))
        trace = result["syntheticDecisionTrace"]
        self.assertEqual(trace["selectedRuleId"], "mixedMarkers")
        outcomes = {x["ruleId"]: x["outcome"] for x in trace["orderedRuleOutcomes"]}
        self.assertEqual(outcomes["linkedMesh"], "matchedButOverridden")
        self.assertEqual(outcomes["sharedSii"], "matchedButOverridden")
        self.assertNotEqual(trace["selectedRuleId"], "linkedMesh")

    def test_unlinked_extra_o3d_cannot_rewrite_link_decision(self):
        entries = candidate()
        entries.append((BASE + "model/unreferenced.o3d", b"\x84\x19\x05" + b"\x00"*300))
        result = package(entries)
        self.assertEqual(result["assessment"], "omsi-fixture-candidate")
        self.assertEqual(result["syntheticDecisionTrace"]["selectedRuleId"], "linkedMesh")
        self.assertFalse(result["syntheticDecisionTrace"]["realFormatValidated"])

    def test_order_of_zip_entries_does_not_change_decision_trace(self):
        entries = candidate((("def/truck.sii", TRUCK),))
        a = package(entries)
        b = package(list(reversed(entries)))
        self.assertEqual(a["syntheticDecisionTrace"], b["syntheticDecisionTrace"])
        self.assertEqual(a["assessment"], b["assessment"])

    def test_same_paths_different_zip_bytes_do_not_leak_or_authenticate(self):
        a = package(candidate())
        b = package(candidate((("notes.txt", b"PRIVATE_DELIBERATELY_DIFFERENT"),)))
        self.assertEqual(a["syntheticDecisionTrace"], b["syntheticDecisionTrace"])
        self.assertFalse(a["syntheticScopeIsAuthenticatedOrigin"])
        self.assertFalse(b["syntheticScopeIsAuthenticatedOrigin"])
        self.assertNotIn("PRIVATE_DELIBERATELY_DIFFERENT",
                         json.dumps(b["syntheticDecisionTrace"]))

    def test_diagnostic_text_is_fixed_not_user_controlled(self):
        entries = candidate((("private_data.txt", b"SECRET_CONTENT_M17"),))
        result = package(entries)
        exported = json.dumps(result["syntheticDecisionTrace"])
        for secret in ("PrivateVariantM17", "SECRET_CONTENT_M17",
                       "Vehicles/", "Bus.bus", "body.o3d", "hash", "sha256"):
            self.assertNotIn(secret, exported)
        self.assertLess(len(exported), 1700)

    def test_mismatched_user_claim_is_refused_not_explained(self):
        one = counters(paired=1, linked=1, meshLinked=1, bus=1, cfg=1)
        with self.assertRaisesRegex(
                ValueError, "^CONTROLLED_FIXTURE_DECISION_TRACE_REFUSED$"):
            explain_controlled_fixture_decision(
                "omsi-model-mesh-unconfirmed", one, True)

    def test_inconsistent_hierarchy_rejected_without_paths(self):
        invalid = (
            counters(paired=0, linked=1, meshLinked=1, bus=1, cfg=1),
            counters(paired=1, linked=0, meshLinked=1, bus=1, cfg=1),
            counters(paired=2, linked=1, meshLinked=1, bus=1, cfg=2),
        )
        for values in invalid:
            with self.subTest(values=values):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_FIXTURE_DECISION_TRACE_REFUSED$"):
                    explain_controlled_fixture_decision(
                        "omsi-fixture-candidate", values, True)

    def test_forged_scope_missing_keys_boolean_counts_and_names_refused(self):
        good = counters(paired=1, linked=1, meshLinked=1, bus=1, cfg=1)
        tests = [
            ("omsi-fixture-candidate", good, False),
            ("omsi-fixture-candidate", good, 1),
            ("secret-file-name", good, True),
            ("omsi-fixture-candidate", {**good, "truck": True}, True),
            ("omsi-fixture-candidate", {**good, "bus": -1}, True),
            ("omsi-fixture-candidate", {**good, "secret": 1}, True),
            ("omsi-fixture-candidate", {"paired": 1}, True),
        ]
        for assessment, values, scope in tests:
            with self.subTest(assessment=assessment, scope=scope):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_FIXTURE_DECISION_TRACE_REFUSED$"):
                    explain_controlled_fixture_decision(assessment, values, scope)

    def test_decision_not_inferred_from_o3d_evidence_without_bus_cfg(self):
        entries = [("Vehicles/PrivateVariantM17/stray.o3d",
                    b"\x84\x19\x05" + b"\x00"*100)]
        result = package(entries)
        self.assertEqual(result["assessment"], "no-recognizable-fixture-evidence")
        self.assertEqual(result["syntheticDecisionTrace"]["selectedRuleId"],
                         "noRecognizableMarkers")
        self.assertFalse(result["gameRecognized"])


if __name__ == "__main__":
    unittest.main()
