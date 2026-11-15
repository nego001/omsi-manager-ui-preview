"""M13: synthetic bounded O3D matrix-section adversarial contracts, no real mods."""
import io
import json
import math
import struct
import unittest
import zipfile

from controlled_fixture_game_hints import assess_controlled_zip_game_hints
from controlled_o3d_matrix_hints import (
    MAX_O3D_MATRIX_SAMPLE, classify_bounded_o3d_matrix_section
)

BUS = b"[model]\nmodel/linked.cfg\n"
CFG = b"[mesh]\nlinked.o3d\n"
VERTEX = struct.pack("<8f", 1, 2, 3, 0, 0, 1, 0.25, 0.5)
MATERIAL_FLOATS = struct.pack("<11f", 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 2)
IDENTITY = (1., 0., 0., 0., 0., 1., 0., 0.,
            0., 0., 1., 0., 0., 0., 0., 1.)


def through_materials(version=5, flags=0, material_names=(b"LocalMat",),
                      triangles=((0, 1, 2, 0),)):
    header = bytes((0x84, 0x19, version))
    if version >= 3:
        header += bytes((flags,))
    if version >= 4:
        header += bytes(4)
    count_size = 2 if version == 1 else 4
    index_size = 4 if version >= 3 and flags & 1 else 2
    blob = bytearray(header)
    blob += b"\x17" + (3).to_bytes(count_size, "little") + 3 * VERTEX
    blob += b"\x49" + len(triangles).to_bytes(count_size, "little")
    for i, j, k, material_id in triangles:
        for index in (i, j, k):
            blob += index.to_bytes(index_size, "little")
        blob += material_id.to_bytes(2, "little")
    blob += b"\x26" + len(material_names).to_bytes(2, "little")
    for opaque_name in material_names:
        blob += MATERIAL_FLOATS + bytes((len(opaque_name),)) + opaque_name
    return bytes(blob)


def model(version=5, flags=0, matrix=IDENTITY, **kwargs):
    return through_materials(version, flags, **kwargs) + b"\x79" + struct.pack("<16f", *matrix)


def inspect(entries):
    memory = io.BytesIO()
    with zipfile.ZipFile(memory, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, payload in entries:
            archive.writestr(name, payload)
    return assess_controlled_zip_game_hints(memory.getvalue())


def chain(mesh):
    return [
        ("Vehicles/PrivateVariantM13/PrivateBus.bus", BUS),
        ("Vehicles/PrivateVariantM13/model/linked.cfg", CFG),
        ("Vehicles/PrivateVariantM13/model/linked.o3d", mesh),
    ]


class ControlledO3dMatrixHintsTests(unittest.TestCase):
    def test_supported_synthetic_versions_and_flags_are_only_layout_hints(self):
        for version, flags in ((1, 0), (3, 0), (3, 1), (4, 0),
                               (5, 0), (5, 1), (7, 0), (7, 1)):
            with self.subTest(version=version, flags=flags):
                payload = model(version, flags)
                self.assertEqual(
                    classify_bounded_o3d_matrix_section(payload, len(payload)),
                    "plausibleBoundedMatrixLayout")
                report = inspect(chain(payload))
                self.assertEqual(report["assessment"], "omsi-fixture-candidate")
                self.assertEqual(report["omsiBoundedMaterialHintLinkedVehicleFolderCount"], 1)
                self.assertEqual(report["omsiBoundedMatrixHintLinkedVehicleFolderCount"], 1)
                self.assertEqual(report["omsiMeshLinkedWithoutBoundedMatrixHintFolderCount"], 0)
                self.assertEqual(report["o3dMatrixSectionHintCounts"]["plausibleBoundedMatrixLayout"], 1)
                for flag_name in ("meshFormatVerified", "evidenceAuthenticated", "gameRecognized",
                                  "realModInspected", "compatibilityVerified",
                                  "installationEnabled", "realGameFilesTouched"):
                    self.assertFalse(report[flag_name])

    def test_protected_or_unknown_flag_bits_not_promoted(self):
        for version, flags in ((7, 3), (7, 2), (5, 0x80), (3, 2)):
            with self.subTest(version=version, flags=flags):
                payload = model(version, flags)
                report = inspect(chain(payload))
                self.assertEqual(report["o3dMatrixSectionHintCounts"]["extendedFlagsUnconfirmed"], 1)
                self.assertEqual(report["omsiBoundedMaterialHintLinkedVehicleFolderCount"], 1)
                self.assertEqual(report["omsiBoundedMatrixHintLinkedVehicleFolderCount"], 0)
                self.assertFalse(report["meshFormatVerified"])

    def test_absent_or_unexpected_matrix_tag(self):
        prefix = through_materials()
        for payload, code in (
            (prefix, "missingMatrixSection"),
            (prefix + b"\x54" + struct.pack("<16f", *IDENTITY), "unsupportedMatrixSection"),
            (prefix + b"\x00\x79" + struct.pack("<16f", *IDENTITY),
             "unsupportedMatrixSection"),
        ):
            with self.subTest(code=code):
                report = inspect(chain(payload))
                self.assertEqual(report["o3dMatrixSectionHintCounts"][code], 1)
                self.assertEqual(report["omsiBoundedMaterialHintLinkedVehicleFolderCount"], 1)
                self.assertEqual(report["omsiBoundedMatrixHintLinkedVehicleFolderCount"], 0)

    def test_partial_matrix_payload_does_not_qualify(self):
        prefix = through_materials() + b"\x79"
        for n in (0, 1, 3, 4, 32, 63):
            with self.subTest(n=n):
                data = prefix + struct.pack("<16f", *IDENTITY)[:n]
                report = inspect(chain(data))
                self.assertEqual(report["o3dMatrixSectionHintCounts"]["truncatedMatrixPayload"], 1)
                self.assertEqual(report["omsiBoundedMatrixHintLinkedVehicleFolderCount"], 0)

    def test_nan_and_infinity_are_an_unconfirmed_synthetic_hint(self):
        for idx, value in ((0, float("nan")), (12, float("inf")), (15, -float("inf"))):
            with self.subTest(idx=idx):
                coords = list(IDENTITY)
                coords[idx] = value
                payload = model(matrix=coords)
                report = inspect(chain(payload))
                self.assertEqual(report["o3dMatrixSectionHintCounts"]["nonFiniteMatrixElements"], 1)
                self.assertEqual(report["omsiBoundedMatrixHintLinkedVehicleFolderCount"], 0)
                self.assertNotIn("Infinity", json.dumps(report))
                self.assertNotIn("NaN", json.dumps(report))

    def test_non_affine_finite_values_are_not_semantically_certified(self):
        coords = tuple(17.25 for _ in range(16))
        payload = model(matrix=coords)
        report = inspect(chain(payload))
        self.assertEqual(report["omsiBoundedMatrixHintLinkedVehicleFolderCount"], 1)
        self.assertFalse(report["meshFormatVerified"])
        self.assertFalse(report["compatibilityVerified"])

    def test_material_not_confirmed_blocks_matrix_hint(self):
        payload = b"\x84\x19\x05" + b"\x79" + struct.pack("<16f", *IDENTITY)
        report = inspect(chain(payload))
        self.assertEqual(report["o3dMatrixSectionHintCounts"]["materialSectionUnconfirmed"], 1)
        self.assertEqual(report["omsiBoundedMatrixHintLinkedVehicleFolderCount"], 0)

    def test_unrelated_o3d_cannot_lend_matrix_hint(self):
        entries = chain(through_materials())
        entries.append(("Vehicles/PrivateVariantM13/model/unlinked.o3d", model()))
        report = inspect(entries)
        self.assertEqual(report["o3dMatrixSectionHintCounts"]["plausibleBoundedMatrixLayout"], 1)
        self.assertEqual(report["omsiBoundedMatrixHintLinkedVehicleFolderCount"], 0)

    def test_other_variant_and_unlinked_cfg_cannot_lend_matrix(self):
        entries = chain(through_materials())
        entries.extend([
            ("Vehicles/OtherVariant/model/linked.o3d", model()),
            ("Vehicles/PrivateVariantM13/unused.cfg", b"[mesh]\nother.o3d\n"),
            ("Vehicles/PrivateVariantM13/other.o3d", model()),
        ])
        report = inspect(entries)
        self.assertEqual(report["omsiBoundedMatrixHintLinkedVehicleFolderCount"], 0)
        self.assertEqual(report["omsiMeshLinkedWithoutBoundedMatrixHintFolderCount"], 1)

    def test_mixed_sii_cannot_choose_a_game_or_installation(self):
        entries = chain(model())
        entries.append(("def/truck.sii", b"SiiNunit\n{\nvehicle : test.truck\n}\n"))
        report = inspect(entries)
        self.assertEqual(report["assessment"], "mixed-markers-ambiguous")
        self.assertEqual(report["omsiBoundedMatrixHintLinkedVehicleFolderCount"], 1)
        self.assertFalse(report["gameRecognized"])
        self.assertFalse(report["installationEnabled"])

    def test_no_raw_payload_names_or_matrix_values_in_public_output(self):
        coords = tuple(27.125 for _ in range(16))
        payload = model(matrix=coords, material_names=(b"PrivateMaterialMatrixM13",))
        report = inspect(chain(payload + b"PrivateAfterMatrixBytes"))
        serialized = json.dumps(report)
        for private in ("PrivateVariantM13", "PrivateBus.bus", "PrivateMaterialMatrixM13",
                        "PrivateAfterMatrixBytes", "27.125", "Vehicles/", "linked.o3d"):
            self.assertNotIn(private, serialized)

    def test_bounded_material_table_and_matrix_prefix_fits_budget(self):
        names = tuple(b"M" + bytes((65+i,)) for i in range(16))
        triangles = ((0, 1, 2, 0),) * 64
        payload = model(material_names=names, triangles=triangles)
        self.assertLessEqual(len(payload), MAX_O3D_MATRIX_SAMPLE)
        self.assertEqual(classify_bounded_o3d_matrix_section(payload, len(payload)),
                         "plausibleBoundedMatrixLayout")

    def test_invalid_api_inputs_fail_closed_with_constant_message(self):
        payload = model()
        invalid = (
            (bytearray(payload), len(payload)),
            ("private.o3d", 11),
            (b"x" * (MAX_O3D_MATRIX_SAMPLE + 1), MAX_O3D_MATRIX_SAMPLE + 1),
            (payload, len(payload) - 1),
            (payload, -1),
            (payload, True),
        )
        for sample, n in invalid:
            with self.subTest(type=type(sample).__name__, size=n):
                with self.assertRaisesRegex(ValueError, "^CONTROLLED_O3D_MATRIX_REFUSED$"):
                    classify_bounded_o3d_matrix_section(sample, n)


if __name__ == "__main__":
    unittest.main()
