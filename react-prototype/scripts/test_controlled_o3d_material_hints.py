"""M12 synthetic O3D material and triangle-material reference tests. No real mods."""
import io
import json
import struct
import unittest
import zipfile

from controlled_fixture_game_hints import assess_controlled_zip_game_hints
from controlled_o3d_material_hints import (
    MAX_O3D_MATERIAL_SAMPLE, classify_bounded_o3d_material_references
)

BUS = b"[model]\nmodel/model.cfg\n"
CFG = b"[mesh]\nbody.o3d\n"
VERTEX = struct.pack("<8f", 1, 2, 3, 0, 0, 1, 0.3, 0.6)
FLOATS = struct.pack("<11f", 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 2)


def first_two_sections(version=5, flags=0, faces=((0, 1, 2, 0),)):
    hdr = bytes((0x84, 0x19, version))
    if version >= 3:
        hdr += bytes((flags,))
    if version >= 4:
        hdr += bytes(4)
    count_width = 2 if version == 1 else 4
    index_width = 4 if version >= 3 and flags & 1 else 2
    buf = bytearray(hdr + b"\x17" + (3).to_bytes(count_width, "little") + 3 * VERTEX)
    buf += b"\x49" + len(faces).to_bytes(count_width, "little")
    for a, b, c, material in faces:
        for vertex in (a, b, c):
            buf += vertex.to_bytes(index_width, "little")
        buf += material.to_bytes(2, "little")
    return bytes(buf)


def material_block(name=b"MatSynthetic"):
    return FLOATS + bytes((len(name),)) + name


def full_model(version=5, flags=0, faces=((0, 1, 2, 0),),
               names=(b"MatSynthetic",)):
    return (first_two_sections(version, flags, faces)
            + b"\x26" + len(names).to_bytes(2, "little")
            + b"".join(material_block(name) for name in names))


def inspect(entries):
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, data in entries:
            zf.writestr(name, data)
    return assess_controlled_zip_game_hints(out.getvalue())


def chain(o3d):
    return [
        ("Vehicles/SecretVariantM12/Private.bus", BUS),
        ("Vehicles/SecretVariantM12/model/model.cfg", CFG),
        ("Vehicles/SecretVariantM12/model/body.o3d", o3d),
    ]


class ControlledO3dMaterialHintTests(unittest.TestCase):
    def test_valid_synthetic_material_references_across_observed_versions(self):
        for version, flags in ((1, 0), (3, 0), (3, 1), (4, 0),
                               (5, 0), (5, 1), (7, 0), (7, 3)):
            with self.subTest(version=version, flags=flags):
                payload = full_model(
                    version, flags,
                    faces=((0, 1, 2, 0), (2, 1, 0, 1)),
                    names=(b"MatA", b"MatB"))
                self.assertEqual(
                    classify_bounded_o3d_material_references(payload, len(payload)),
                    "plausibleBoundedMaterialReferences")
                report = inspect(chain(payload))
                self.assertEqual(report["assessment"], "omsi-fixture-candidate")
                self.assertEqual(report["omsiBoundedMaterialHintLinkedVehicleFolderCount"], 1)
                self.assertEqual(report["omsiMeshLinkedWithoutBoundedMaterialHintFolderCount"], 0)
                self.assertEqual(
                    report["o3dMaterialReferenceHintCounts"]["plausibleBoundedMaterialReferences"], 1)
                for flag in ("meshFormatVerified", "evidenceAuthenticated",
                             "gameRecognized", "realModInspected",
                             "compatibilityVerified", "installationEnabled",
                             "realGameFilesTouched"):
                    self.assertFalse(report[flag])

    def test_missing_or_unsupported_material_tag(self):
        base = first_two_sections()
        for payload, code in (
            (base, "missingMaterialSection"),
            (base + b"\x79", "unsupportedMaterialSection"),
        ):
            with self.subTest(code=code):
                report = inspect(chain(payload))
                self.assertEqual(report["o3dMaterialReferenceHintCounts"][code], 1)
                self.assertEqual(report["omsiBoundedMaterialHintLinkedVehicleFolderCount"], 0)
                self.assertEqual(report["omsiBoundedTriangleHintLinkedVehicleFolderCount"], 1)

    def test_truncated_zero_or_over_budget_material_counts(self):
        base = first_two_sections() + b"\x26"
        cases = (
            (base + b"\x01", "truncatedMaterialCount"),
            (base + b"\x00\x00", "zeroMaterialCount"),
            (base + b"\x11\x00", "countOverBudget"),
        )
        for sample, code in cases:
            with self.subTest(code=code):
                report = inspect(chain(sample))
                self.assertEqual(report["o3dMaterialReferenceHintCounts"][code], 1)
                self.assertEqual(report["omsiBoundedMaterialHintLinkedVehicleFolderCount"], 0)

    def test_truncated_floats_and_variable_length_name(self):
        prefix = first_two_sections() + b"\x26\x01\x00"
        cases = (
            (prefix + FLOATS[:20], "truncatedMaterialFloats"),
            (prefix + FLOATS, "missingMaterialNameLength"),
            (prefix + FLOATS + b"\x00", "emptyMaterialName"),
            (prefix + FLOATS + b"\x31", "nameOverBudget"),
            (prefix + FLOATS + b"\x05xy", "truncatedMaterialName"),
        )
        for sample, code in cases:
            with self.subTest(code=code):
                self.assertEqual(
                    classify_bounded_o3d_material_references(sample, len(sample)), code)
                report = inspect(chain(sample))
                self.assertEqual(report["o3dMaterialReferenceHintCounts"][code], 1)

    def test_triangle_material_slot_outside_declared_material_table(self):
        for value in (1, 255, 65535):
            with self.subTest(index=value):
                sample = full_model(faces=((0, 1, 2, value),))
                report = inspect(chain(sample))
                self.assertEqual(
                    report["o3dMaterialReferenceHintCounts"]["outOfRangeTriangleMaterial"], 1)
                self.assertEqual(report["omsiBoundedMaterialHintLinkedVehicleFolderCount"], 0)

    def test_material_budget_16_allowed_17_outside_fixture_budget(self):
        names = tuple((b"mat" + bytes((65 + i,))) for i in range(16))
        good = full_model(names=names)
        self.assertLessEqual(len(good), MAX_O3D_MATERIAL_SAMPLE)
        self.assertEqual(
            classify_bounded_o3d_material_references(good, len(good)),
            "plausibleBoundedMaterialReferences")
        too_many = first_two_sections() + b"\x26\x11\x00"
        self.assertEqual(
            classify_bounded_o3d_material_references(too_many, len(too_many)),
            "countOverBudget")

    def test_material_bytes_not_evidence_without_triangle_section(self):
        fake = b"fake" + b"\x26\x01\x00" + material_block()
        report = inspect(chain(fake))
        self.assertEqual(report["o3dMaterialReferenceHintCounts"]["triangleSectionUnconfirmed"], 1)
        self.assertEqual(report["omsiBoundedMaterialHintLinkedVehicleFolderCount"], 0)

    def test_other_mesh_in_same_variant_does_not_lend_material_hint(self):
        entries = chain(first_two_sections())
        entries.append(("Vehicles/SecretVariantM12/model/unlinked.o3d", full_model()))
        report = inspect(entries)
        self.assertEqual(report["o3dMaterialReferenceHintCounts"]["plausibleBoundedMaterialReferences"], 1)
        self.assertEqual(report["omsiBoundedMaterialHintLinkedVehicleFolderCount"], 0)

    def test_other_variant_or_unlinked_cfg_does_not_lend_material_hint(self):
        entries = chain(first_two_sections())
        entries.append(("Vehicles/AnotherVariant/model/body.o3d", full_model()))
        entries.extend((
            ("Vehicles/SecretVariantM12/unused.cfg", b"[mesh]\nother.o3d\n"),
            ("Vehicles/SecretVariantM12/other.o3d", full_model()),
        ))
        report = inspect(entries)
        self.assertEqual(report["omsiBoundedMaterialHintLinkedVehicleFolderCount"], 0)
        self.assertEqual(report["omsiMeshLinkedWithoutBoundedMaterialHintFolderCount"], 1)

    def test_mixed_sii_marker_still_ambiguous(self):
        entries = chain(full_model())
        entries.append(("def/truck.sii", b"SiiNunit\n{\nvehicle : test.truck\n}\n"))
        report = inspect(entries)
        self.assertEqual(report["assessment"], "mixed-markers-ambiguous")
        self.assertEqual(report["omsiBoundedMaterialHintLinkedVehicleFolderCount"], 1)
        self.assertFalse(report["gameRecognized"])

    def test_names_paths_floats_and_payload_never_in_report(self):
        marker = b"PrivateMaterialOwnerSecret"
        report = inspect(chain(full_model(names=(marker,)) + b"PrivateTrailingBytes"))
        data = json.dumps(report)
        for token in ("SecretVariantM12", "Private.bus", "Vehicles/",
                      "PrivateMaterialOwnerSecret", "PrivateTrailingBytes", "model/body.o3d"):
            self.assertNotIn(token, data)

    def test_invalid_direct_inputs_fail_with_fixed_message(self):
        sample = full_model()
        for value, size in (
            (bytearray(sample), len(sample)),
            ("private.o3d", 12),
            (b"X" * (MAX_O3D_MATERIAL_SAMPLE + 1), MAX_O3D_MATERIAL_SAMPLE + 1),
            (sample, len(sample) - 1),
            (sample, -1),
            (sample, True),
        ):
            with self.subTest(t=type(value).__name__, size=size):
                with self.assertRaisesRegex(ValueError, "^CONTROLLED_O3D_MATERIAL_REFUSED$"):
                    classify_bounded_o3d_material_references(value, size)


if __name__ == "__main__":
    unittest.main()
