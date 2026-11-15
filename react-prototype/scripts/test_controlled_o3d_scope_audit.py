"""M16 synthetic package-local O3D provenance and counter audits (in-memory)."""
import hashlib
import io
import json
import unittest
import zipfile

from controlled_fixture_game_hints import assess_controlled_zip_game_hints
from controlled_o3d_evidence_coordinator import O3D_EVIDENCE_STATES
from controlled_o3d_scope_audit import (
    ControlledO3dScopeRefused, audit_synthetic_o3d_scope,
    make_synthetic_entry_receipt, STAGES, LINKS
)
from test_controlled_o3d_bone_hints import synthetic, base_model

PATH = "vehicles/privatevariantm16/model/body.o3d"
VARIANT = "vehicles/privatevariantm16"


def test_snapshot(state="boundedBoneLayoutObserved"):
    archive_digest = hashlib.sha256(b"fixture-A").digest()
    entry_digest = hashlib.sha256(b"synthetic-O3D-A").digest()
    stages = {stage: frozenset() for stage in STAGES}
    links = {stage: frozenset() for stage in LINKS}
    if state == "boundedBoneLayoutObserved":
        fields = ("header", "vertex", "triangle", "material", "matrix", "bone")
    elif state == "matrixWithOptionalBonesAbsent":
        fields = ("header", "vertex", "triangle", "material", "matrix",
                  "optionalBoneAbsent")
    else:
        fields = ()
    for stage in fields:
        stages[stage] = frozenset((PATH,))
        links[stage] = frozenset((VARIANT,))
    links["linked"] = frozenset((VARIANT,))
    links["mesh"] = frozenset((VARIANT,))
    counts = {key: int(key == state) for key in O3D_EVIDENCE_STATES}
    return [
        frozenset((PATH, VARIANT + "/model/model.cfg")),
        stages, {PATH: state}, counts, links,
        archive_digest, {PATH: entry_digest},
        {PATH: make_synthetic_entry_receipt(archive_digest, PATH, entry_digest)}
    ]


def zip_report(mesh, variant="privatevariantm16"):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("Vehicles/" + variant + "/Bus.bus", b"[model]\nmodel/model.cfg\n")
        zf.writestr("Vehicles/" + variant + "/model/model.cfg",
                    b"[mesh]\nbody.o3d\n")
        zf.writestr("Vehicles/" + variant + "/model/body.o3d", mesh)
    return assess_controlled_zip_game_hints(output.getvalue())


class ControlledO3dScopeAuditTests(unittest.TestCase):
    def test_consistent_synthetic_scopes_and_absent_optional_bones(self):
        for state in ("boundedBoneLayoutObserved", "matrixWithOptionalBonesAbsent"):
            with self.subTest(state=state):
                snap = test_snapshot(state)
                self.assertTrue(audit_synthetic_o3d_scope(*snap))

    def test_end_to_end_audit_keeps_recognition_and_installation_disabled(self):
        for mesh, state in (
            (synthetic(), "boundedBoneLayoutObserved"),
            (base_model(), "matrixWithOptionalBonesAbsent"),
            (b"not-an-o3d", "noSupportedHeader"),
        ):
            with self.subTest(state=state):
                report = zip_report(mesh)
                self.assertEqual(report["o3dSyntheticEvidenceStateCounts"][state], 1)
                self.assertTrue(report["syntheticScopeConsistencyChecked"])
                for field in ("syntheticScopeIsAuthenticatedOrigin",
                              "syntheticEvidenceIsRealFormatProof",
                              "meshFormatVerified", "evidenceAuthenticated",
                              "gameRecognized", "realModInspected",
                              "compatibilityVerified", "installationEnabled",
                              "realGameFilesTouched"):
                    self.assertFalse(report[field])

    def test_two_zip_invocations_with_same_path_remain_independent(self):
        a = zip_report(synthetic())
        b = zip_report(b"not-an-o3d")
        self.assertEqual(a["o3dSyntheticEvidenceStateCounts"]["boundedBoneLayoutObserved"], 1)
        self.assertEqual(b["o3dSyntheticEvidenceStateCounts"]["noSupportedHeader"], 1)
        self.assertEqual(b["o3dSyntheticEvidenceStateCounts"]["boundedBoneLayoutObserved"], 0)
        self.assertTrue(a["syntheticScopeConsistencyChecked"])
        self.assertTrue(b["syntheticScopeConsistencyChecked"])

    def test_foreign_archive_receipt_with_same_entry_name_is_refused(self):
        snap = test_snapshot()
        other_archive = hashlib.sha256(b"fixture-B").digest()
        snap[7][PATH] = make_synthetic_entry_receipt(
            other_archive, PATH, snap[6][PATH])
        with self.assertRaisesRegex(ControlledO3dScopeRefused,
                                    "^CONTROLLED_O3D_SCOPE_REFUSED$"):
            audit_synthetic_o3d_scope(*snap)

    def test_foreign_file_digest_receipt_is_refused(self):
        snap = test_snapshot()
        foreign_entry = hashlib.sha256(b"other O3D bytes").digest()
        snap[7][PATH] = make_synthetic_entry_receipt(
            snap[5], PATH, foreign_entry)
        with self.assertRaises(ControlledO3dScopeRefused):
            audit_synthetic_o3d_scope(*snap)

    def test_mismatching_report_count_and_bool_count_refused(self):
        for count in (0, True, -1):
            with self.subTest(count=count):
                snap = test_snapshot()
                snap[3]["boundedBoneLayoutObserved"] = count
                with self.assertRaises(ControlledO3dScopeRefused):
                    audit_synthetic_o3d_scope(*snap)

    def test_later_stage_with_no_prior_entry_evidence_refused(self):
        for stage in ("header", "vertex", "triangle", "material", "matrix", "bone"):
            with self.subTest(stage=stage):
                snap = test_snapshot()
                snap[1][stage] = frozenset()
                with self.assertRaises(ControlledO3dScopeRefused):
                    audit_synthetic_o3d_scope(*snap)

    def test_foreign_stage_entry_outside_current_zip_refused(self):
        snap = test_snapshot()
        snap[1]["bone"] = frozenset((PATH, "vehicles/elsewhere/body.o3d"))
        with self.assertRaises(ControlledO3dScopeRefused):
            audit_synthetic_o3d_scope(*snap)

    def test_missing_entry_state_and_unknown_label_refused(self):
        for change in ("missing", "contradiction"):
            snap = test_snapshot()
            if change == "missing":
                snap[2].clear()
            else:
                snap[2][PATH] = "inconsistentSyntheticStageEvidence"
            with self.subTest(change=change):
                with self.assertRaises(ControlledO3dScopeRefused):
                    audit_synthetic_o3d_scope(*snap)

    def test_linked_variant_hierarchy_and_zip_provenance_refused_on_forgery(self):
        for key, value in (
            ("mesh", frozenset()),
            ("bone", frozenset(("vehicles/foreignvariant",))),
            ("matrix", frozenset()),
        ):
            snap = test_snapshot()
            snap[4][key] = value
            with self.subTest(key=key):
                with self.assertRaises(ControlledO3dScopeRefused):
                    audit_synthetic_o3d_scope(*snap)

    def test_bone_and_absent_optional_cannot_coexist_on_same_o3d(self):
        snap = test_snapshot()
        snap[1]["optionalBoneAbsent"] = frozenset((PATH,))
        with self.assertRaises(ControlledO3dScopeRefused):
            audit_synthetic_o3d_scope(*snap)

    def test_invalid_types_digest_lengths_and_nonascii_fail_closed(self):
        for position, value in (
            (0, set((PATH,))),
            (5, b"short"),
            (6, {PATH: b"bad"}),
            (7, {PATH: b"bad"}),
        ):
            snap = test_snapshot()
            snap[position] = value
            with self.subTest(position=position):
                with self.assertRaises(ControlledO3dScopeRefused):
                    audit_synthetic_o3d_scope(*snap)
        with self.assertRaises(ControlledO3dScopeRefused):
            make_synthetic_entry_receipt(b"x" * 32, "veículos/secret.o3d", b"y" * 32)

    def test_no_path_hash_or_content_leaks_to_public_json(self):
        report = zip_report(synthetic() + b"SECRET_FUTURE_BYTES")
        serialized = json.dumps(report)
        for secret in ("privatevariantm16", "SECRET_FUTURE_BYTES",
                       "vehicles/", "body.o3d", "sha256", "entry_receipts"):
            self.assertNotIn(secret, serialized)
        self.assertEqual(sum(report["o3dSyntheticEvidenceStateCounts"].values()), 1)


if __name__ == "__main__":
    unittest.main()
