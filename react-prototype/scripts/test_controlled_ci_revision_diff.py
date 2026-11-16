"""M19: adversarial checks of revision probes and CI-only fixed fixtures."""
import json
from pathlib import Path
import unittest

from controlled_ci_revision_diff import (
    GROUPS, MAX_PROBE_OUTPUT_BYTES, REVISION_PROBE_SCHEMA,
    _decode_probe, _freeze, _probe_checkout,
    ci_synthetic_fixtures, compare_two_revision_probes
)
from controlled_fixture_regression_guard import (
    capture_synthetic_fixture_snapshot
)


def wire_fixture(fixture: bytes) -> bytes:
    snap = capture_synthetic_fixture_snapshot(fixture)
    return json.dumps([value for _, value in snap.groups],
                      separators=(",", ":"), allow_nan=False).encode()


class ControlledCiRevisionDiffTests(unittest.TestCase):
    def test_exactly_nine_original_synthetic_fixtures_and_no_large_zips(self):
        fixtures = ci_synthetic_fixtures()
        self.assertEqual(len(fixtures), 9)
        self.assertEqual(len(set(fixtures)), 9)
        self.assertTrue(all(0 < len(blob) <= 2_000_000 for blob in fixtures))
        self.assertTrue(all(blob[:2] == b"PK" for blob in fixtures))
        self.assertEqual(REVISION_PROBE_SCHEMA,
                         "synthetic-two-revision-comparison-v1")

    def test_identical_revision_snapshot_json_is_stable(self):
        for fixture in ci_synthetic_fixtures():
            with self.subTest(size=len(fixture)):
                payload = wire_fixture(fixture)
                result = compare_two_revision_probes(fixture, payload, payload)
                self.assertEqual(result["comparison"], "stable")
                self.assertEqual(result["changedContractGroups"], [])
                self.assertTrue(result["sameSyntheticZipBytesCompared"])
                for field in ("baselineAuthenticityEstablished",
                              "changeIsAutomaticallyProvenRegression",
                              "realModValidated", "installationAuthorized"):
                    self.assertFalse(result[field])

    def test_same_bytes_changed_contract_group_requires_review(self):
        fixture = ci_synthetic_fixtures()[0]
        wire = wire_fixture(fixture)
        changed = json.loads(wire)
        # Group 3 = fixed-order linked-variant counters.
        changed[3][2] += 1
        mutated = json.dumps(changed).encode()
        result = compare_two_revision_probes(fixture, wire, mutated)
        self.assertEqual(result["comparison"], "reviewRequired")
        self.assertEqual(result["changedContractGroups"],
                         ["linkedVariantCounters"])
        self.assertFalse(result["changeIsAutomaticallyProvenRegression"])

    def test_same_bytes_changed_o3d_stage_group_requires_review(self):
        fixture = ci_synthetic_fixtures()[-1]
        first = wire_fixture(fixture)
        modified = json.loads(first)
        modified[5][0] += 1
        result = compare_two_revision_probes(
            fixture, first, json.dumps(modified).encode())
        self.assertEqual(result["comparison"], "reviewRequired")
        self.assertEqual(result["changedContractGroups"],
                         ["o3dEvidenceStateCounts"])

    def test_invalid_or_forged_wire_snapshots_fail_closed(self):
        fixture = ci_synthetic_fixtures()[0]
        valid = wire_fixture(fixture)
        variants = [
            b"",
            b"not json",
            json.dumps({"secret": "filename.o3d"}).encode(),
            json.dumps(["private/file.o3d"]).encode(),
            b" " * (MAX_PROBE_OUTPUT_BYTES + 1),
        ]
        altered = json.loads(valid)
        altered[6][-1] = True  # Must never set installationAuthorized.
        variants.append(json.dumps(altered).encode())
        altered = json.loads(valid)
        altered[1] = "privateO3D"
        variants.append(json.dumps(altered).encode())
        for candidate in variants:
            with self.subTest(length=len(candidate)):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_CI_REVISION_DIFF_REFUSED$"):
                    compare_two_revision_probes(fixture, valid, candidate)

    def test_wire_depth_long_name_and_weird_types_rejected(self):
        fixture = ci_synthetic_fixtures()[0]
        valid = wire_fixture(fixture)
        variants = (
            [0] * (len(GROUPS) + 1),
            ["x" * 129] + [0] * (len(GROUPS) - 1),
            [None] * len(GROUPS),
            [[[[[[[1]]]]]]] + [0] * (len(GROUPS) - 1),
        )
        for raw in variants:
            with self.subTest(payload=str(raw)[:20]):
                with self.assertRaisesRegex(
                        ValueError, "^CONTROLLED_CI_REVISION_DIFF_REFUSED$"):
                    compare_two_revision_probes(
                        fixture, valid, json.dumps(raw).encode())

    def test_real_isolated_python_probe_executes_current_fixture_analyzer(self):
        # The GitHub Actions job uses TWO separate checkouts. Unit tests
        # only smoke-test the subprocess contract against this checkout.
        fixture = ci_synthetic_fixtures()[0]
        scripts = Path(__file__).resolve().parent
        result = _probe_checkout(scripts, fixture)
        expected = capture_synthetic_fixture_snapshot(fixture)
        self.assertEqual(result.groups, expected.groups)
        self.assertEqual(result.fixture_digest, expected.fixture_digest)

    def test_no_provenance_or_paths_leak_through_comparison(self):
        fixture = ci_synthetic_fixtures()[0]
        wire = wire_fixture(fixture)
        output = json.dumps(compare_two_revision_probes(fixture, wire, wire))
        for secret in ("ControlledM19", "Vehicles/", "body.o3d", "sha256",
                       "fixture_digest", "INVALID_ON_PURPOSE"):
            self.assertNotIn(secret, output)

    def test_no_arbitrary_root_or_json_objects_can_be_frozen(self):
        for bad in ({"path": "secret"}, None, 1.5):
            with self.assertRaises(ValueError):
                _freeze(bad)
        with self.assertRaises(ValueError):
            _probe_checkout(Path("/tmp/not-a-fixture"), ci_synthetic_fixtures()[0])

    def test_bad_digest_wire_promotion_does_not_grant_approval(self):
        fixture = ci_synthetic_fixtures()[0]
        wire = wire_fixture(fixture)
        altered = json.loads(wire)
        altered[6][0] = True  # Authentication flag forbidden in M18 guard.
        with self.assertRaisesRegex(ValueError,
                                    "^CONTROLLED_CI_REVISION_DIFF_REFUSED$"):
            compare_two_revision_probes(fixture, wire, json.dumps(altered).encode())


if __name__ == "__main__":
    unittest.main()
