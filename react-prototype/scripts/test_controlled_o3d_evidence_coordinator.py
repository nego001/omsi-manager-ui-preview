"""M15: per-O3D synthetic evidence coordinator contracts. No real mod input."""
import json
import unittest

from controlled_o3d_evidence_coordinator import (
    CONTRADICTION_STATE, O3D_EVIDENCE_STATES,
    classify_fixture_o3d_evidence, empty_evidence_counts
)
from test_controlled_o3d_bone_hints import (
    base_model, synthetic, chain, inspect
)

GOOD = (
    "plausiblePrefix",
    "plausibleBoundedVertexPayload",
    "plausibleBoundedTriangleIndices",
    "plausibleBoundedMaterialReferences",
    "plausibleBoundedMatrixLayout",
    "plausibleBoundedBoneWeights",
)


def assert_not_promoted(testcase, result):
    for field in ("meshFormatVerified", "evidenceAuthenticated",
                  "gameRecognized", "realModInspected",
                  "compatibilityVerified", "installationEnabled",
                  "realGameFilesTouched", "syntheticEvidenceIsRealFormatProof"):
        testcase.assertFalse(result[field])


class ControlledO3dEvidenceCoordinatorTests(unittest.TestCase):
    def test_bone_stage_is_per_o3d_not_format_certification(self):
        self.assertEqual(classify_fixture_o3d_evidence(*GOOD),
                         "boundedBoneLayoutObserved")
        result = inspect(chain(synthetic()))
        self.assertEqual(result["o3dSyntheticEvidenceStateCounts"]["boundedBoneLayoutObserved"], 1)
        self.assertEqual(result["omsiBoundedBoneHintLinkedVehicleFolderCount"], 1)
        self.assertEqual(result["omsiOptionalBoneAbsentLinkedVehicleFolderCount"], 0)
        self.assertEqual(result["assessment"], "omsi-fixture-candidate")
        assert_not_promoted(self, result)

    def test_missing_optional_bones_is_not_a_failure(self):
        result = inspect(chain(base_model()))
        self.assertEqual(result["o3dSyntheticEvidenceStateCounts"]["matrixWithOptionalBonesAbsent"], 1)
        self.assertEqual(result["omsiOptionalBoneAbsentLinkedVehicleFolderCount"], 1)
        self.assertEqual(result["omsiBoundedBoneHintLinkedVehicleFolderCount"], 0)
        self.assertEqual(result["assessment"], "omsi-fixture-candidate")
        assert_not_promoted(self, result)

    def test_stages_cannot_be_combined_across_two_o3d_entries(self):
        entries = chain(base_model())
        entries.append(("Vehicles/PrivateVariantM14/model/unlinked.o3d", synthetic()))
        result = inspect(entries)
        self.assertEqual(result["o3dSyntheticEvidenceStateCounts"]["matrixWithOptionalBonesAbsent"], 1)
        self.assertEqual(result["o3dSyntheticEvidenceStateCounts"]["boundedBoneLayoutObserved"], 1)
        # Two separate O3Ds, never one virtual completed O3D.
        self.assertEqual(result["omsiBoundedBoneHintLinkedVehicleFolderCount"], 0)
        self.assertEqual(result["omsiOptionalBoneAbsentLinkedVehicleFolderCount"], 1)
        self.assertEqual(result["assessment"], "omsi-fixture-candidate")
        assert_not_promoted(self, result)

    def test_other_variant_cannot_borrow_bone_evidence(self):
        entries = chain(base_model())
        entries.append(("Vehicles/AnotherVariant/model/body.o3d", synthetic()))
        result = inspect(entries)
        self.assertEqual(result["o3dSyntheticEvidenceStateCounts"]["boundedBoneLayoutObserved"], 1)
        self.assertEqual(result["omsiBoundedBoneHintLinkedVehicleFolderCount"], 0)
        self.assertEqual(result["omsiOptionalBoneAbsentLinkedVehicleFolderCount"], 1)

    def test_unlinked_cfg_cannot_lend_optional_bone_evidence(self):
        entries = chain(b"fake model")
        entries.extend([
            ("Vehicles/PrivateVariantM14/unused.cfg", b"[mesh]\nmissing.o3d\n"),
            ("Vehicles/PrivateVariantM14/model/other.o3d", base_model()),
        ])
        result = inspect(entries)
        self.assertEqual(result["o3dSyntheticEvidenceStateCounts"]["matrixWithOptionalBonesAbsent"], 1)
        self.assertEqual(result["omsiOptionalBoneAbsentLinkedVehicleFolderCount"], 0)

    def test_contradiction_detects_positive_later_stage_without_earlier(self):
        cases = [
            ("magicMismatch",) + GOOD[1:],
            (GOOD[0], "headerUnconfirmed") + GOOD[2:],
            GOOD[:2] + ("vertexSectionUnconfirmed",) + GOOD[3:],
            GOOD[:3] + ("triangleSectionUnconfirmed",) + GOOD[4:],
            GOOD[:4] + ("materialSectionUnconfirmed",) + GOOD[5:],
            GOOD[:5] + ("matrixSectionUnconfirmed",),
        ]
        for labels in cases:
            with self.subTest(labels=labels):
                self.assertEqual(
                    classify_fixture_o3d_evidence(*labels),
                    CONTRADICTION_STATE)

    def test_finite_matrix_does_not_force_bone_presence(self):
        base = GOOD[:5]
        self.assertEqual(
            classify_fixture_o3d_evidence(*(base + ("optionalBoneSectionAbsent",))),
            "matrixWithOptionalBonesAbsent")
        self.assertEqual(
            classify_fixture_o3d_evidence(*(base + ("boneSectionOutsideSampleBudget",))),
            "matrixWithBoneSectionOutsideBudget")
        self.assertEqual(
            classify_fixture_o3d_evidence(*(base + ("truncatedBoneCount",))),
            "matrixWithBonesUnconfirmed")

    def test_partial_evidence_uses_deepest_supported_layer_not_composite(self):
        cases = (
            (("magicMismatch", "headerUnconfirmed", "vertexSectionUnconfirmed",
              "triangleSectionUnconfirmed", "materialSectionUnconfirmed",
              "matrixSectionUnconfirmed"), "noSupportedHeader"),
            (("plausiblePrefix", "missingFirstSection", "vertexSectionUnconfirmed",
              "triangleSectionUnconfirmed", "materialSectionUnconfirmed",
              "matrixSectionUnconfirmed"), "headerOnly"),
            (GOOD[:2] + ("missingTriangleSection", "triangleSectionUnconfirmed",
                         "materialSectionUnconfirmed", "matrixSectionUnconfirmed"),
             "vertexLayoutOnly"),
            (GOOD[:3] + ("missingMaterialSection", "materialSectionUnconfirmed",
                         "matrixSectionUnconfirmed"), "triangleIndexOnly"),
            (GOOD[:4] + ("extendedFlagsUnconfirmed", "matrixSectionUnconfirmed"),
             "materialLayoutOnly"),
        )
        for labels, expected in cases:
            with self.subTest(expected=expected):
                self.assertEqual(classify_fixture_o3d_evidence(*labels), expected)

    def test_reject_unrecognized_or_mutable_input_labels_without_echo(self):
        for idx in range(6):
            values = list(GOOD)
            values[idx] = "private_o3d_path_512"
            with self.assertRaisesRegex(ValueError, "^CONTROLLED_O3D_EVIDENCE_REFUSED$"):
                classify_fixture_o3d_evidence(*values)
        with self.assertRaisesRegex(ValueError, "^CONTROLLED_O3D_EVIDENCE_REFUSED$"):
            classify_fixture_o3d_evidence(*GOOD[:-1], bytearray(b"PRIVATE"))

    def test_fixed_public_report_counts_never_include_names_or_contents(self):
        result = inspect(chain(synthetic() + b"PrivateAfterBoneM15"))
        exposed = json.dumps(result)
        for secret in ("PrivateVariantM14", "Private.bus", "PrivateAfterBoneM15",
                       "Vehicles/", "model/body.o3d"):
            self.assertNotIn(secret, exposed)
        self.assertEqual(set(result["o3dSyntheticEvidenceStateCounts"]), set(O3D_EVIDENCE_STATES))
        self.assertEqual(sum(result["o3dSyntheticEvidenceStateCounts"].values()), 1)
        self.assertEqual(empty_evidence_counts(), {name: 0 for name in O3D_EVIDENCE_STATES})

    def test_mixed_truck_signal_must_remain_ambiguous(self):
        entries = chain(synthetic())
        entries.append(("def/truck.sii", b"SiiNunit\n{\nvehicle : demo.truck\n}\n"))
        result = inspect(entries)
        self.assertEqual(result["assessment"], "mixed-markers-ambiguous")
        self.assertEqual(result["o3dSyntheticEvidenceStateCounts"]["boundedBoneLayoutObserved"], 1)
        assert_not_promoted(self, result)


if __name__ == "__main__":
    unittest.main()
