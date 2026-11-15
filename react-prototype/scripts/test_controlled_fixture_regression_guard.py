"""M18: CI-only golden decisions and same-bytes synthetic regression comparisons."""
from dataclasses import replace
import hashlib
import io
import json
import unittest
import zipfile

from controlled_fixture_regression_guard import (
    GROUPS, SCHEMA, SyntheticFixtureSnapshot,
    capture_synthetic_fixture_snapshot,
    compare_synthetic_fixture_snapshots,
)

BASE = "Vehicles/PrivateM18/"
BUS = b"[model]\nmodel/model.cfg\n"
CFG = b"[mesh]\nbody.o3d\n"
SII = b"SiiNunit\n{\nvehicle : synthetic.truck\n}\n"
O3D = b"NO_REAL_GEOMETRY_HERE"


def archive(entries):
    memory = io.BytesIO()
    with zipfile.ZipFile(memory, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path, data in entries:
            zf.writestr(path, data)
    return memory.getvalue()


def fixture_entries():
    return [
        (BASE + "A.bus", BUS),
        (BASE + "model/model.cfg", CFG),
        (BASE + "model/body.o3d", O3D),
    ]


def edited(snapshot, group, new_value):
    groups = tuple(
        (name, new_value if name == group else value)
        for name, value in snapshot.groups)
    return replace(snapshot, groups=groups)


def group(snapshot, name):
    return dict(snapshot.groups)[name]


class ControlledFixtureRegressionGuardTests(unittest.TestCase):
    def test_identical_fixture_bytes_produce_stable_output(self):
        data = archive(fixture_entries())
        a = capture_synthetic_fixture_snapshot(data)
        b = capture_synthetic_fixture_snapshot(data)
        result = compare_synthetic_fixture_snapshots(a, b)
        self.assertEqual(result["schema"], SCHEMA)
        self.assertEqual(result["comparison"], "stable")
        self.assertEqual(result["changedContractGroups"], ())
        self.assertEqual(tuple(name for name, _ in a.groups), GROUPS)
        self.assertTrue(result["sameSyntheticZipBytesCompared"])
        for name in ("changeIsAutomaticallyProvenRegression",
                     "baselineAuthenticityEstablished",
                     "realModValidated", "installationAuthorized"):
            self.assertFalse(result[name])

    def test_golden_seven_classifications_and_rule_ids_do_not_drift(self):
        cases = (
            (fixture_entries(), "omsi-fixture-candidate", "linkedMesh", (1, 1, 1)),
            (fixture_entries() + [("def/truck.sii", SII)],
             "mixed-markers-ambiguous", "mixedMarkers", (1, 1, 1)),
            (fixture_entries()[:2],
             "omsi-model-mesh-unconfirmed", "linkedModelWithoutMesh", (1, 1, 0)),
            ([(BASE + "A.bus", b"[model]\nmodel/missing.cfg\n"),
              (BASE + "model/model.cfg", CFG)],
             "unlinked-omsi-fixture-markers", "pairedWithoutLink", (1, 0, 0)),
            ([(BASE + "A.bus", BUS)],
             "insufficient-omsi-fixture-evidence", "isolatedOmSiMarker", (0, 0, 0)),
            ([("def/truck.sii", SII)],
             "ets2-ats-shared-format-ambiguous", "sharedSii", (0, 0, 0)),
            ([("private_notes.txt", b"test-only private notes")],
             "no-recognizable-fixture-evidence", "noRecognizableMarkers", (0, 0, 0)),
        )
        for files, expected_assessment, expected_rule, expected_counts in cases:
            with self.subTest(rule=expected_rule):
                data = archive(files)
                snapshot = capture_synthetic_fixture_snapshot(data)
                self.assertEqual(group(snapshot, "assessment"), expected_assessment)
                self.assertEqual(group(snapshot, "selectedRule"), expected_rule)
                self.assertEqual(group(snapshot, "linkedVariantCounters")[:3],
                                 expected_counts)
                self.assertEqual(
                    compare_synthetic_fixture_snapshots(
                        snapshot, capture_synthetic_fixture_snapshot(data))["comparison"],
                    "stable")

    def test_same_bytes_changed_counters_require_review_not_automatic_bug_claim(self):
        snapshot = capture_synthetic_fixture_snapshot(archive(fixture_entries()))
        values = list(group(snapshot, "linkedVariantCounters"))
        values[2] += 1
        changed = edited(snapshot, "linkedVariantCounters", tuple(values))
        result = compare_synthetic_fixture_snapshots(snapshot, changed)
        self.assertEqual(result["comparison"], "reviewRequired")
        self.assertEqual(result["changedContractGroups"], ("linkedVariantCounters",))
        self.assertFalse(result["changeIsAutomaticallyProvenRegression"])

    def test_same_bytes_changed_o3d_classification_requires_review(self):
        snapshot = capture_synthetic_fixture_snapshot(archive(fixture_entries()))
        values = [list(row) for row in group(snapshot, "o3dStructuralHintCounts")]
        values[0][0] += 1
        changed = edited(snapshot, "o3dStructuralHintCounts",
                         tuple(tuple(row) for row in values))
        result = compare_synthetic_fixture_snapshots(snapshot, changed)
        self.assertEqual(result["comparison"], "reviewRequired")
        self.assertEqual(result["changedContractGroups"], ("o3dStructuralHintCounts",))

    def test_same_bytes_changed_decision_needs_consistent_rule_contract_and_review(self):
        snapshot = capture_synthetic_fixture_snapshot(archive(fixture_entries()))
        other = edited(snapshot, "assessment", "mixed-markers-ambiguous")
        other = edited(other, "selectedRule", "mixedMarkers")
        outcomes = list(group(snapshot, "orderedRuleOutcomes"))
        outcomes[0] = "selected"
        outcomes[1] = "matchedButOverridden"
        other = edited(other, "orderedRuleOutcomes", tuple(outcomes))
        result = compare_synthetic_fixture_snapshots(snapshot, other)
        self.assertEqual(result["comparison"], "reviewRequired")
        self.assertEqual(result["changedContractGroups"],
                         ("assessment", "selectedRule", "orderedRuleOutcomes"))
        self.assertFalse(result["realModValidated"])

    def test_safety_guard_ever_true_must_be_refused(self):
        snapshot = capture_synthetic_fixture_snapshot(archive(fixture_entries()))
        guards = list(group(snapshot, "safetyInvariants"))
        guards[-1] = True
        forged = edited(snapshot, "safetyInvariants", tuple(guards))
        with self.assertRaisesRegex(ValueError, "^CONTROLLED_FIXTURE_REGRESSION_REFUSED$"):
            compare_synthetic_fixture_snapshots(snapshot, forged)

    def test_different_fixture_bytes_never_claim_regression(self):
        a = capture_synthetic_fixture_snapshot(archive(fixture_entries()))
        b = capture_synthetic_fixture_snapshot(archive(
            fixture_entries() + [("notes.txt", b"PRIVATE_SECOND_ZIP_BYTES")]))
        self.assertEqual(a.groups, b.groups)
        self.assertNotEqual(a.fixture_digest, b.fixture_digest)
        with self.assertRaisesRegex(ValueError, "^CONTROLLED_FIXTURE_REGRESSION_REFUSED$"):
            compare_synthetic_fixture_snapshots(a, b)

    def test_zip_entry_reordering_changes_bytes_even_if_decision_does_not(self):
        entries = fixture_entries()
        a = capture_synthetic_fixture_snapshot(archive(entries))
        b = capture_synthetic_fixture_snapshot(archive(list(reversed(entries))))
        self.assertEqual(a.groups, b.groups)
        self.assertNotEqual(a.fixture_digest, b.fixture_digest)
        with self.assertRaises(ValueError):
            compare_synthetic_fixture_snapshots(a, b)

    def test_corrupt_digest_shape_or_snapshot_type_refused(self):
        a = capture_synthetic_fixture_snapshot(archive(fixture_entries()))
        for invalid in (
            replace(a, fixture_digest=b"bad"),
            replace(a, fixture_digest=hashlib.sha256(b"foreign").digest()),
            replace(a, groups=(("assessment", "secret"),)),
            {"fixture_digest": a.fixture_digest, "groups": a.groups},
            None,
        ):
            with self.subTest(kind=type(invalid).__name__):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_FIXTURE_REGRESSION_REFUSED$"):
                    compare_synthetic_fixture_snapshots(a, invalid)

    def test_bad_counter_bool_and_unknown_structural_labels_refused(self):
        a = capture_synthetic_fixture_snapshot(archive(fixture_entries()))
        variants = list(group(a, "linkedVariantCounters"))
        variants[0] = True
        forged = edited(a, "linkedVariantCounters", tuple(variants))
        with self.assertRaises(ValueError):
            compare_synthetic_fixture_snapshots(a, forged)
        forged = edited(a, "selectedRule", "private/path.o3d")
        with self.assertRaises(ValueError):
            compare_synthetic_fixture_snapshots(a, forged)
        forged = edited(a, "orderedRuleOutcomes", ("selected",))
        with self.assertRaises(ValueError):
            compare_synthetic_fixture_snapshots(a, forged)

    def test_invalid_input_types_and_oversize_are_refused_with_fixed_message(self):
        for payload in (
            b"", "local/path.zip", bytearray(b"fake"),
            b"x" * 2_000_001,
        ):
            with self.subTest(kind=type(payload).__name__):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_FIXTURE_REGRESSION_REFUSED$"):
                    capture_synthetic_fixture_snapshot(payload)

    def test_report_never_returns_private_paths_hashes_or_raw_values(self):
        data = archive(fixture_entries() + [
            ("secret-notes.txt", b"VERY_PRIVATE_TEST_PAYLOAD_M18")])
        snapshot = capture_synthetic_fixture_snapshot(data)
        result = compare_synthetic_fixture_snapshots(snapshot, snapshot)
        serialized = json.dumps(result)
        for secret in ("PrivateM18", "VERY_PRIVATE_TEST_PAYLOAD_M18",
                       "Vehicles/", "body.o3d", "fixture_digest", "sha256",
                       snapshot.fixture_digest.hex()):
            self.assertNotIn(secret, serialized)
        self.assertFalse(result["baselineAuthenticityEstablished"])


if __name__ == "__main__":
    unittest.main()
