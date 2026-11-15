"""M11 adversarial synthetic first-triangle-section O3D tests. No real mods."""
import io
import json
import struct
import unittest
import zipfile

from controlled_fixture_game_hints import assess_controlled_zip_game_hints
from controlled_o3d_triangle_hints import (
    MAX_O3D_TRIANGLE_SAMPLE, classify_bounded_o3d_triangle_indices
)

BUS = b"[model]\nmodel/body.cfg\n"
CFG = b"[mesh]\nmesh.o3d\n"
VERTEX = struct.pack("<8f", 1, 2, 3, 0, 0, 1, 0.5, 0.5)


def vertex_only(version=5, flags=0, vertices=3):
    header = bytes((0x84, 0x19, version))
    if version >= 3:
        header += bytes((flags,))
    if version >= 4:
        header += bytes(4)
    width = 2 if version == 1 else 4
    return header + b"\x17" + vertices.to_bytes(width, "little") + VERTEX * vertices


def triangle_table(version=5, flags=0, vertices=3, faces=((0, 1, 2),)):
    sample = vertex_only(version, flags, vertices)
    width = 2 if version == 1 else 4
    index_width = 4 if version >= 3 and flags & 1 else 2
    out = bytearray(sample + b"\x49" + len(faces).to_bytes(width, "little"))
    for face in faces:
        for index in face:
            out.extend(index.to_bytes(index_width, "little"))
        out.extend(b"\x00\x00")  # opaque synthetic material index
    return bytes(out)


def inspect(entries):
    stream = io.BytesIO()
    with zipfile.ZipFile(stream, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, payload in entries:
            archive.writestr(name, payload)
    return assess_controlled_zip_game_hints(stream.getvalue())


def linked(mesh):
    return [
        ("Vehicles/SecretVariantM11/Chosen.bus", BUS),
        ("Vehicles/SecretVariantM11/model/body.cfg", CFG),
        ("Vehicles/SecretVariantM11/model/mesh.o3d", mesh),
    ]


class O3dTriangleHintTests(unittest.TestCase):
    def test_versions_and_both_index_widths_remain_uncertified(self):
        cases = ((1, 0), (3, 0), (3, 1), (4, 0), (5, 0),
                 (5, 1), (7, 0), (7, 3))
        for version, flags in cases:
            with self.subTest(version=version, flags=flags):
                sample = triangle_table(version, flags)
                self.assertEqual(
                    classify_bounded_o3d_triangle_indices(sample, len(sample)),
                    "plausibleBoundedTriangleIndices")
                result = inspect(linked(sample))
                self.assertEqual(result["assessment"], "omsi-fixture-candidate")
                self.assertEqual(result["omsiBoundedTriangleHintLinkedVehicleFolderCount"], 1)
                self.assertEqual(result["omsiMeshLinkedWithoutBoundedTriangleHintFolderCount"], 0)
                self.assertEqual(
                    result["o3dTriangleIndexHintCounts"]["plausibleBoundedTriangleIndices"], 1)
                for guard in ("meshFormatVerified", "evidenceAuthenticated",
                              "gameRecognized", "realModInspected",
                              "compatibilityVerified", "installationEnabled",
                              "realGameFilesTouched"):
                    self.assertFalse(result[guard])

    def test_missing_or_unsupported_triangle_tag_not_promoted(self):
        for data, expected in (
            (vertex_only(), "missingTriangleSection"),
            (vertex_only() + b"\x26", "unsupportedTriangleSection"),
        ):
            with self.subTest(kind=expected):
                result = inspect(linked(data))
                self.assertEqual(result["assessment"], "omsi-fixture-candidate")
                self.assertEqual(result["omsiBoundedVertexHintLinkedVehicleFolderCount"], 1)
                self.assertEqual(result["o3dTriangleIndexHintCounts"][expected], 1)
                self.assertEqual(result["omsiBoundedTriangleHintLinkedVehicleFolderCount"], 0)

    def test_truncated_count_payload_and_zero_count_rejected_as_hint(self):
        cases = (
            (vertex_only() + b"\x49\x01", "truncatedTriangleCount"),
            (triangle_table()[:-3], "truncatedTrianglePayload"),
            (vertex_only() + b"\x49" + (0).to_bytes(4, "little"), "zeroTriangleCount"),
            (vertex_only() + b"\x49" + (65).to_bytes(4, "little"), "countOverBudget"),
        )
        for data, expected in cases:
            with self.subTest(kind=expected):
                self.assertEqual(
                    classify_bounded_o3d_triangle_indices(data, len(data)), expected)
                result = inspect(linked(data))
                self.assertEqual(result["o3dTriangleIndexHintCounts"][expected], 1)
                self.assertEqual(result["omsiBoundedTriangleHintLinkedVehicleFolderCount"], 0)

    def test_sixteen_and_thirty_two_bit_out_of_range_indices(self):
        for flags, face in ((0, (0, 1, 3)), (1, (0, 1, 65536)),
                            (1, (0, 1, 4294967295))):
            with self.subTest(flags=flags, face=face):
                data = triangle_table(flags=flags, faces=(face,))
                result = inspect(linked(data))
                self.assertEqual(result["o3dTriangleIndexHintCounts"]["outOfRangeVertexIndex"], 1)
                self.assertEqual(result["omsiBoundedTriangleHintLinkedVehicleFolderCount"], 0)

    def test_max_synthetic_triangle_budget_direct_and_overflow(self):
        maximal = triangle_table(faces=((0, 1, 2),) * 64)
        self.assertLessEqual(len(maximal), MAX_O3D_TRIANGLE_SAMPLE)
        self.assertEqual(classify_bounded_o3d_triangle_indices(maximal, len(maximal)),
                         "plausibleBoundedTriangleIndices")
        overflowing = vertex_only() + b"\x49" + (65).to_bytes(4, "little")
        self.assertEqual(classify_bounded_o3d_triangle_indices(overflowing, len(overflowing)),
                         "countOverBudget")

    def test_vertex_section_must_pass_first(self):
        for data in (b"fake", b"\x84\x19\xff", vertex_only(vertices=0)):
            with self.subTest(length=len(data)):
                result = inspect(linked(data))
                self.assertEqual(result["o3dTriangleIndexHintCounts"]["vertexSectionUnconfirmed"], 1)
                self.assertEqual(result["omsiBoundedTriangleHintLinkedVehicleFolderCount"], 0)

    def test_unreferenced_or_other_variant_triangle_does_not_borrow_evidence(self):
        for name in ("Vehicles/SecretVariantM11/model/unused.o3d",
                     "Vehicles/AnotherVariant/model/mesh.o3d"):
            with self.subTest(other_path=name):
                entries = linked(b"fake mesh")
                entries.append((name, triangle_table()))
                result = inspect(entries)
                self.assertEqual(
                    result["o3dTriangleIndexHintCounts"]["plausibleBoundedTriangleIndices"], 1)
                self.assertEqual(result["omsiBoundedTriangleHintLinkedVehicleFolderCount"], 0)

    def test_unlinked_cfg_triangle_does_not_borrow_evidence(self):
        entries = linked(b"fake mesh")
        entries.extend([
            ("Vehicles/SecretVariantM11/model/other.cfg", b"[mesh]\nother.o3d\n"),
            ("Vehicles/SecretVariantM11/model/other.o3d", triangle_table()),
        ])
        result = inspect(entries)
        self.assertEqual(result["omsiBoundedTriangleHintLinkedVehicleFolderCount"], 0)

    def test_sii_mix_remains_ambiguous_with_triangle_hint(self):
        entries = linked(triangle_table())
        entries.append(("def/truck.sii", b"SiiNunit\n{\nvehicle : demo.truck\n}\n"))
        result = inspect(entries)
        self.assertEqual(result["assessment"], "mixed-markers-ambiguous")
        self.assertEqual(result["omsiBoundedTriangleHintLinkedVehicleFolderCount"], 1)
        self.assertFalse(result["gameRecognized"])

    def test_private_bytes_names_or_indices_are_never_returned(self):
        entries = linked(triangle_table() + b"PRIVATE_CUSTOMER_DATA")
        result = inspect(entries)
        serial = json.dumps(result)
        for prohibited in ("SecretVariantM11", "Chosen.bus", "PRIVATE_CUSTOMER_DATA",
                           "Vehicles/", "model/mesh.o3d"):
            self.assertNotIn(prohibited, serial)

    def test_bad_api_inputs_fail_closed_without_echo(self):
        data = triangle_table()
        invalid = (
            (bytearray(data), len(data)),
            ("hidden.o3d", 8),
            (b"x" * (MAX_O3D_TRIANGLE_SAMPLE + 1), MAX_O3D_TRIANGLE_SAMPLE + 1),
            (data, len(data) - 1),
            (data, -1),
            (data, True),
        )
        for value, n in invalid:
            with self.subTest(type=type(value).__name__, size=n):
                with self.assertRaisesRegex(ValueError, "^CONTROLLED_O3D_TRIANGLE_REFUSED$"):
                    classify_bounded_o3d_triangle_indices(value, n)


if __name__ == "__main__":
    unittest.main()
