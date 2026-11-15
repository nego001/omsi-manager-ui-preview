"""M14 adversarial synthetic O3D 0x54 bone/weight fixtures, never real mods."""
import io
import json
import struct
import unittest
import zipfile

from controlled_fixture_game_hints import assess_controlled_zip_game_hints
from controlled_o3d_bone_hints import (
    MAX_O3D_BONE_SAMPLE, classify_bounded_o3d_bone_weights
)

BUS = b"[model]\nmodel/model.cfg\n"
CFG = b"[mesh]\nbody.o3d\n"
VERTEX = struct.pack("<8f", 1, 2, 3, 0, 0, 1, 0.25, 0.5)
MATERIAL = struct.pack("<11f", 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 2)
MATRIX = struct.pack("<16f", 1, 0, 0, 0, 0, 1, 0, 0,
                     0, 0, 1, 0, 0, 0, 0, 1)


def base_model(version=5, flags=0):
    header = bytes((0x84, 0x19, version))
    if version >= 3:
        header += bytes((flags,))
    if version >= 4:
        header += bytes(4)
    count_size = 2 if version == 1 else 4
    index_size = 4 if version >= 3 and flags & 1 else 2
    payload = bytearray(header)
    payload += b"\x17" + (3).to_bytes(count_size, "little") + VERTEX * 3
    payload += b"\x49" + (1).to_bytes(count_size, "little")
    for index in (0, 1, 2):
        payload += index.to_bytes(index_size, "little")
    payload += (0).to_bytes(2, "little")
    payload += b"\x26" + (1).to_bytes(2, "little")
    payload += MATERIAL + b"\x05Local"
    payload += b"\x79" + MATRIX
    return bytes(payload)


def bones_section(version=5, flags=0, bones=((b"BoneA", ((0, 0.25), (2, 0.75))),)):
    index_size = 4 if version >= 3 and flags & 1 else 2
    payload = bytearray(b"\x54" + len(bones).to_bytes(2, "little"))
    for name, weights in bones:
        payload += bytes((len(name),)) + name
        payload += len(weights).to_bytes(2, "little")
        for vertex, weight in weights:
            payload += vertex.to_bytes(index_size, "little")
            payload += struct.pack("<f", weight)
    return bytes(payload)


def synthetic(version=5, flags=0, bones=None):
    if bones is None:
        return base_model(version, flags) + bones_section(version, flags)
    return base_model(version, flags) + bones


def inspect(entries):
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, data in entries:
            zf.writestr(name, data)
    return assess_controlled_zip_game_hints(out.getvalue())


def chain(mesh):
    return [
        ("Vehicles/PrivateVariantM14/Private.bus", BUS),
        ("Vehicles/PrivateVariantM14/model/model.cfg", CFG),
        ("Vehicles/PrivateVariantM14/model/body.o3d", mesh),
    ]


class ControlledO3dBoneHintsTests(unittest.TestCase):
    def test_supported_versions_and_16_32_bit_indices_are_only_hints(self):
        for version, flags in ((1, 0), (3, 0), (3, 1), (4, 0),
                               (5, 0), (5, 1), (7, 0), (7, 1)):
            with self.subTest(version=version, flags=flags):
                sample = synthetic(version, flags)
                self.assertEqual(
                    classify_bounded_o3d_bone_weights(sample, len(sample)),
                    "plausibleBoundedBoneWeights")
                report = inspect(chain(sample))
                self.assertEqual(report["assessment"], "omsi-fixture-candidate")
                self.assertEqual(report["omsiBoundedBoneHintLinkedVehicleFolderCount"], 1)
                self.assertEqual(report["omsiMeshLinkedWithoutBoundedBoneHintFolderCount"], 0)
                self.assertEqual(report["o3dBoneWeightHintCounts"]["plausibleBoundedBoneWeights"], 1)
                for field in ("meshFormatVerified", "evidenceAuthenticated",
                              "gameRecognized", "realModInspected",
                              "compatibilityVerified", "installationEnabled",
                              "realGameFilesTouched"):
                    self.assertFalse(report[field])

    def test_no_optional_bone_section_does_not_mean_bad_mesh(self):
        sample = base_model()
        report = inspect(chain(sample))
        self.assertEqual(report["assessment"], "omsi-fixture-candidate")
        self.assertEqual(report["o3dMatrixSectionHintCounts"]["plausibleBoundedMatrixLayout"], 1)
        self.assertEqual(report["o3dBoneWeightHintCounts"]["optionalBoneSectionAbsent"], 1)
        self.assertEqual(report["omsiBoundedBoneHintLinkedVehicleFolderCount"], 0)
        self.assertFalse(report["meshFormatVerified"])

    def test_protected_flags_or_missing_prior_matrix_remain_unconfirmed(self):
        for sample in (synthetic(7, 3), b"not a model"):
            report = inspect(chain(sample))
            self.assertEqual(report["o3dBoneWeightHintCounts"]["matrixSectionUnconfirmed"], 1)
            self.assertEqual(report["omsiBoundedBoneHintLinkedVehicleFolderCount"], 0)

    def test_unknown_tag_and_incomplete_bone_count(self):
        prefix = base_model()
        for sample, label in (
            (prefix + b"\x79" + b"\x00" * 2, "unsupportedTrailingSection"),
            (prefix + b"\x54", "truncatedBoneCount"),
            (prefix + b"\x54\x01", "truncatedBoneCount"),
            (prefix + b"\x54\x00\x00", "zeroBoneCount"),
            (prefix + b"\x54\x05\x00", "boneCountOverBudget"),
        ):
            with self.subTest(label=label):
                report = inspect(chain(sample))
                self.assertEqual(report["o3dBoneWeightHintCounts"][label], 1)
                self.assertEqual(report["omsiBoundedBoneHintLinkedVehicleFolderCount"], 0)

    def test_incomplete_bone_name_or_weight_table(self):
        prefix = base_model() + b"\x54\x01\x00"
        cases = (
            (prefix, "missingBoneNameLength"),
            (prefix + b"\x00", "emptyBoneName"),
            (prefix + b"\x31", "boneNameOverBudget"),
            (prefix + b"\x05AB", "truncatedBoneName"),
            (prefix + b"\x05BoneA", "truncatedWeightCount"),
            (prefix + b"\x05BoneA\x01", "truncatedWeightCount"),
            (prefix + b"\x05BoneA\x00\x00", "zeroWeightCount"),
            (prefix + b"\x05BoneA\x09\x00", "weightCountOverBudget"),
            (prefix + b"\x05BoneA\x01\x00\x00\x00\x00", "truncatedWeightPayload"),
        )
        for sample, label in cases:
            with self.subTest(label=label):
                self.assertEqual(classify_bounded_o3d_bone_weights(sample, len(sample)), label)
                report = inspect(chain(sample))
                self.assertEqual(report["o3dBoneWeightHintCounts"][label], 1)
                self.assertEqual(report["omsiBoundedBoneHintLinkedVehicleFolderCount"], 0)

    def test_out_of_range_vertex_weight_and_nonfinite_weight(self):
        for face, expected in (
            ((3, 0.5), "outOfRangeBoneVertexIndex"),
            ((65535, 0.5), "outOfRangeBoneVertexIndex"),
            ((0, float("nan")), "nonFiniteBoneWeight"),
            ((0, float("inf")), "nonFiniteBoneWeight"),
        ):
            sample = synthetic(bones=bones_section(bones=((b"BoneA", (face,)),)))
            report = inspect(chain(sample))
            self.assertEqual(report["o3dBoneWeightHintCounts"][expected], 1)
            self.assertEqual(report["omsiBoundedBoneHintLinkedVehicleFolderCount"], 0)
            self.assertNotIn("NaN", json.dumps(report))
            self.assertNotIn("Infinity", json.dumps(report))

    def test_fractional_or_negative_finite_weight_is_not_certified(self):
        sample = synthetic(bones=bones_section(bones=((b"BoneA", ((0, -7.),)),)))
        report = inspect(chain(sample))
        self.assertEqual(report["omsiBoundedBoneHintLinkedVehicleFolderCount"], 1)
        self.assertFalse(report["meshFormatVerified"])

    def test_bounded_four_bones_eight_weights_each(self):
        bones = tuple((b"Bone" + bytes((65+i,)),
                       tuple((j % 3, (j + 1) / 9) for j in range(8)))
                      for i in range(4))
        sample = synthetic(bones=bones_section(bones=bones))
        self.assertLessEqual(len(sample), MAX_O3D_BONE_SAMPLE)
        self.assertEqual(classify_bounded_o3d_bone_weights(sample, len(sample)),
                         "plausibleBoundedBoneWeights")
        report = inspect(chain(sample))
        self.assertEqual(report["omsiBoundedBoneHintLinkedVehicleFolderCount"], 1)

    def test_unlinked_or_different_variant_cannot_lend_bone_hint(self):
        for name in ("Vehicles/PrivateVariantM14/model/unlinked.o3d",
                     "Vehicles/OtherVariant/model/body.o3d"):
            with self.subTest(path=name):
                entries = chain(base_model())
                entries.append((name, synthetic()))
                report = inspect(entries)
                self.assertEqual(report["o3dBoneWeightHintCounts"]["plausibleBoundedBoneWeights"], 1)
                self.assertEqual(report["omsiBoundedBoneHintLinkedVehicleFolderCount"], 0)

    def test_unlinked_cfg_cannot_lend_bone_hint(self):
        entries = chain(base_model())
        entries.extend((
            ("Vehicles/PrivateVariantM14/unused.cfg", b"[mesh]\nother.o3d\n"),
            ("Vehicles/PrivateVariantM14/other.o3d", synthetic()),
        ))
        report = inspect(entries)
        self.assertEqual(report["omsiBoundedBoneHintLinkedVehicleFolderCount"], 0)

    def test_mixed_sii_remains_ambiguous(self):
        entries = chain(synthetic())
        entries.append(("def/truck.sii", b"SiiNunit\n{\nvehicle : test.truck\n}\n"))
        report = inspect(entries)
        self.assertEqual(report["assessment"], "mixed-markers-ambiguous")
        self.assertFalse(report["gameRecognized"])
        self.assertFalse(report["installationEnabled"])

    def test_no_privacy_leak_from_bone_name_weight_or_payload(self):
        private = b"SecretBoneOwnerM14"
        payload = synthetic(bones=bones_section(
            bones=((private, ((0, 27.125),)),))) + b"PrivateFollowingPayload"
        report = inspect(chain(payload))
        serialized = json.dumps(report)
        for item in ("PrivateVariantM14", "Private.bus", "SecretBoneOwnerM14",
                     "PrivateFollowingPayload", "27.125", "Vehicles/", "body.o3d"):
            self.assertNotIn(item, serialized)

    def test_direct_api_bad_inputs_fail_closed(self):
        sample = synthetic()
        bad = (
            (bytearray(sample), len(sample)),
            ("private.o3d", 5),
            (b"x" * (MAX_O3D_BONE_SAMPLE + 1), MAX_O3D_BONE_SAMPLE + 1),
            (sample, len(sample) - 1),
            (sample, -1),
            (sample, True),
        )
        for value, n in bad:
            with self.subTest(type=type(value).__name__, size=n):
                with self.assertRaisesRegex(ValueError, "^CONTROLLED_O3D_BONE_REFUSED$"):
                    classify_bounded_o3d_bone_weights(value, n)


if __name__ == "__main__":
    unittest.main()
