"""Independent M9 O3D-prefix fixture contracts: memory only, no real mods."""
import io
import json
import unittest
import zipfile

from controlled_o3d_header_hints import classify_o3d_header_prefix
from controlled_fixture_game_hints import assess_controlled_zip_game_hints

BUS = b"[model]\nmodel/model.cfg\n"
CFG = b"[mesh]\nbody.o3d\n"
# Deliberately header-only: a plausible prefix is NOT a decodable mesh.
PREFIX = bytes((0x84, 0x19, 5, 0, 0, 0, 0, 0))


def inspect(entries):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, data in entries:
            archive.writestr(name, data)
    return assess_controlled_zip_game_hints(stream.getvalue())


def vehicle(mesh):
    return [
        ("Vehicles/PrivateUnit/Private.bus", BUS),
        ("Vehicles/PrivateUnit/model/model.cfg", CFG),
        ("Vehicles/PrivateUnit/model/body.o3d", mesh),
    ]


class O3dHeaderHintTests(unittest.TestCase):
    def test_observed_version_headers_are_only_plausible(self):
        cases = {
            1: bytes((0x84, 0x19, 1)),
            3: bytes((0x84, 0x19, 3, 0)),
            4: bytes((0x84, 0x19, 4, 0, 0, 0, 0, 0)),
            5: PREFIX,
            7: bytes((0x84, 0x19, 7, 3, 0, 0, 0, 0)),
        }
        for ver, prefix in cases.items():
            with self.subTest(version=ver):
                self.assertEqual(classify_o3d_header_prefix(prefix), "plausiblePrefix")

    def test_short_and_malformed_or_unknown_prefixes_remain_unconfirmed(self):
        samples = [
            (b"", "truncatedPrefix"),
            (bytes((0x84,)), "truncatedPrefix"),
            (bytes((0x84, 0x19, 5)), "truncatedPrefix"),
            (bytes((0x84, 0x19, 3)), "truncatedPrefix"),
            (bytes((0x84, 0x19, 255, 0, 0, 0, 0, 0)), "unknownVersion"),
            (b"fake mesh", "magicMismatch"),
            (b"x", "magicMismatch"),
        ]
        for prefix, expected in samples:
            with self.subTest(expected=expected):
                self.assertEqual(classify_o3d_header_prefix(prefix[:8]), expected)

    def test_oversized_or_mutable_direct_inputs_are_refused(self):
        for value in (bytearray(PREFIX), "secret", b"123456789"):
            with self.assertRaises(ValueError):
                classify_o3d_header_prefix(value)

    def test_linked_prefix_is_only_a_hint_never_model_format_proof(self):
        report = inspect(vehicle(PREFIX))
        self.assertEqual(report["assessment"], "omsi-fixture-candidate")
        self.assertEqual(report["omsiPlausibleO3dHeaderLinkedVehicleFolderCount"], 1)
        self.assertEqual(report["omsiMeshLinkedWithoutPlausibleHeaderFolderCount"], 0)
        self.assertEqual(report["o3dHeaderHintCounts"]["plausiblePrefix"], 1)
        self.assertFalse(report["meshFormatVerified"])
        self.assertFalse(report["gameRecognized"])
        self.assertFalse(report["installationEnabled"])
        self.assertFalse(report["realModInspected"])

    def test_fake_or_truncated_o3d_does_not_qualify_for_header_hint(self):
        for payload, field in ((b"fake", "magicMismatch"),
                               (bytes((0x84, 0x19)), "truncatedPrefix"),
                               (bytes((0x84, 0x19, 255)), "unknownVersion")):
            with self.subTest(kind=field):
                report = inspect(vehicle(payload))
                # Legacy M8 structural candidate is intentionally unchanged.
                self.assertEqual(report["assessment"], "omsi-fixture-candidate")
                self.assertEqual(report["omsiPlausibleO3dHeaderLinkedVehicleFolderCount"], 0)
                self.assertEqual(report["omsiMeshLinkedWithoutPlausibleHeaderFolderCount"], 1)
                self.assertEqual(report["o3dHeaderHintCounts"][field], 1)

    def test_unreferenced_header_cannot_substitute_for_referenced_mesh(self):
        entries = vehicle(b"not an O3D")
        entries.append(("Vehicles/PrivateUnit/model/unused.o3d", PREFIX))
        report = inspect(entries)
        self.assertEqual(report["o3dHeaderHintCounts"]["plausiblePrefix"], 1)
        self.assertEqual(report["omsiPlausibleO3dHeaderLinkedVehicleFolderCount"], 0)

    def test_other_variant_header_cannot_cross_variant_boundary(self):
        entries = vehicle(b"not an O3D")
        entries.append(("Vehicles/Other/model/body.o3d", PREFIX))
        report = inspect(entries)
        self.assertEqual(report["omsiPlausibleO3dHeaderLinkedVehicleFolderCount"], 0)

    def test_no_raw_paths_or_prefix_payloads_in_output(self):
        report = inspect(vehicle(PREFIX + b"secret-owner-payload"))
        serialized = json.dumps(report)
        for private in ("PrivateUnit", "Private.bus", "secret-owner-payload", "Vehicles/"):
            self.assertNotIn(private, serialized)


if __name__ == "__main__":
    unittest.main()
