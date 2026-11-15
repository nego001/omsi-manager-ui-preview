"""M10 adversarial in-memory ZIP O3D first-vertex-section fixtures; no real mods."""
import io
import json
import struct
import unittest
import zipfile

from controlled_o3d_vertex_hints import (
    MAX_O3D_SAMPLE, classify_bounded_o3d_vertex_section
)
from controlled_fixture_game_hints import assess_controlled_zip_game_hints

BUS = b"[model]\nmodel/model.cfg\n"
CFG = b"[mesh]\nbody.o3d\n"
VERTEX = struct.pack("<8f", 1, 2, 3, 0, 1, 0, 0.25, 0.5)


def o3d_header(version=5):
    header = bytes((0x84, 0x19, version))
    return header if version == 1 else (header + b"\x00" if version == 3
                                         else header + b"\x00" * 5)


def fake_o3d(version=5, count=1, data=None):
    width = 2 if version == 1 else 4
    body = VERTEX * count if data is None else data
    return o3d_header(version) + b"\x17" + count.to_bytes(width, "little") + body


def inspect(entries):
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, payload in entries:
            archive.writestr(name, payload)
    return assess_controlled_zip_game_hints(out.getvalue())


def chain(mesh):
    return [
        ("Vehicles/PrivateVariantM10/A.bus", BUS),
        ("Vehicles/PrivateVariantM10/model/model.cfg", CFG),
        ("Vehicles/PrivateVariantM10/model/body.o3d", mesh),
    ]


class O3dVertexHintTests(unittest.TestCase):
    def test_bounded_first_vertex_payload_is_only_structural_hint(self):
        for version in (1, 3, 4, 5, 7):
            with self.subTest(version=version):
                data = fake_o3d(version)
                self.assertEqual(
                    classify_bounded_o3d_vertex_section(data, len(data)),
                    "plausibleBoundedVertexPayload")
                report = inspect(chain(data))
                self.assertEqual(report["assessment"], "omsi-fixture-candidate")
                self.assertEqual(report["omsiMeshLinkedVehicleFolderCount"], 1)
                self.assertEqual(report["omsiBoundedVertexHintLinkedVehicleFolderCount"], 1)
                self.assertEqual(report["omsiMeshLinkedWithoutBoundedVertexHintFolderCount"], 0)
                self.assertEqual(report["o3dVertexSectionHintCounts"]["plausibleBoundedVertexPayload"], 1)
                for flag in ("meshFormatVerified", "gameRecognized", "realModInspected",
                             "compatibilityVerified", "installationEnabled", "realGameFilesTouched"):
                    self.assertFalse(report[flag])

    def test_missing_or_unsupported_first_section_is_not_promoted(self):
        for data, code in (
            (o3d_header(), "missingFirstSection"),
            (o3d_header() + b"\x49", "unsupportedFirstSection"),
        ):
            with self.subTest(kind=code):
                report = inspect(chain(data))
                self.assertEqual(report["assessment"], "omsi-fixture-candidate")
                self.assertEqual(report["o3dVertexSectionHintCounts"][code], 1)
                self.assertEqual(report["omsiBoundedVertexHintLinkedVehicleFolderCount"], 0)
                self.assertEqual(report["omsiMeshLinkedWithoutBoundedVertexHintFolderCount"], 1)

    def test_short_count_and_payload_are_not_accepted(self):
        for data, code in (
            (o3d_header() + b"\x17\x01", "truncatedVertexCount"),
            (fake_o3d(count=1, data=b"\x00" * 8), "truncatedVertexPayload"),
            (fake_o3d(count=0), "zeroVertexCount"),
            (fake_o3d(count=33, data=b""), "countOverBudget"),
        ):
            with self.subTest(kind=code):
                self.assertEqual(classify_bounded_o3d_vertex_section(data, len(data)), code)
                report = inspect(chain(data))
                self.assertEqual(report["o3dVertexSectionHintCounts"][code], 1)
                self.assertEqual(report["omsiBoundedVertexHintLinkedVehicleFolderCount"], 0)

    def test_bounded_limit_accepts_32_but_refuses_33(self):
        good = fake_o3d(count=32)
        self.assertLessEqual(len(good), MAX_O3D_SAMPLE)
        self.assertEqual(classify_bounded_o3d_vertex_section(good, len(good)),
                         "plausibleBoundedVertexPayload")
        big = fake_o3d(count=33)
        self.assertEqual(classify_bounded_o3d_vertex_section(big[:MAX_O3D_SAMPLE], len(big)),
                         "countOverBudget")

    def test_non_header_payload_returns_unconfirmed(self):
        for data in (b"fake mesh", b"\x84\x19", b"\x84\x19\xff\x00"):
            with self.subTest(size=len(data)):
                report = inspect(chain(data))
                self.assertEqual(report["o3dVertexSectionHintCounts"]["headerUnconfirmed"], 1)
                self.assertEqual(report["omsiBoundedVertexHintLinkedVehicleFolderCount"], 0)

    def test_unlinked_plausible_o3d_cannot_substitute_for_referenced_mesh(self):
        entries = chain(b"fake model")
        entries.append(("Vehicles/PrivateVariantM10/model/unused.o3d", fake_o3d()))
        report = inspect(entries)
        self.assertEqual(report["o3dVertexSectionHintCounts"]["plausibleBoundedVertexPayload"], 1)
        self.assertEqual(report["omsiBoundedVertexHintLinkedVehicleFolderCount"], 0)

    def test_another_variant_cannot_qualify(self):
        entries = chain(b"fake model")
        entries.append(("Vehicles/OtherVariant/model/body.o3d", fake_o3d()))
        report = inspect(entries)
        self.assertEqual(report["omsiBoundedVertexHintLinkedVehicleFolderCount"], 0)
        self.assertEqual(report["omsiMeshLinkedWithoutBoundedVertexHintFolderCount"], 1)

    def test_sii_mix_remains_ambiguous(self):
        entries = chain(fake_o3d())
        entries.append(("def/truck.sii", b"SiiNunit\n{\nvehicle : demo.truck\n}\n"))
        report = inspect(entries)
        self.assertEqual(report["assessment"], "mixed-markers-ambiguous")
        self.assertFalse(report["gameRecognized"])

    def test_fixed_public_report_has_no_paths_payloads_or_user_data(self):
        report = inspect(chain(fake_o3d(data=VERTEX + b"PRIVATE_O3D_TAIL")))
        text = json.dumps(report)
        for private in ("PrivateVariantM10", "PRIVATE_O3D_TAIL", "Vehicles/",
                        "model/body.o3d", "A.bus"):
            self.assertNotIn(private, text)

    def test_invalid_direct_inputs_fail_closed_without_content_echo(self):
        for value, size in (
            (bytearray(fake_o3d()), len(fake_o3d())),
            ("filename.o3d", 12),
            (b"A" * (MAX_O3D_SAMPLE + 1), MAX_O3D_SAMPLE + 1),
            (fake_o3d(), 1),
            (fake_o3d(), -1),
            (fake_o3d(), True),
        ):
            with self.subTest(kind=type(value).__name__, size=size):
                with self.assertRaisesRegex(ValueError, "^CONTROLLED_O3D_SECTION_REFUSED$"):
                    classify_bounded_o3d_vertex_section(value, size)


if __name__ == "__main__":
    unittest.main()
