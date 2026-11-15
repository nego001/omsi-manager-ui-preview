"""M6 adversarial CI-generated ZIP fixtures; zero real mods or file I/O."""
import io
import json
import stat
import unittest
import zipfile

from controlled_zip_reader import ControlledZipRefused
from controlled_fixture_game_hints import assess_controlled_zip_game_hints


BUS = b"[friendlyname]\nSynthetic Model\n[model]\nmodel/model.cfg\n"
CFG = b"[mesh]\nbody.o3d\n"
SII = b"SiiNunit\n{\nvehicle : demo.truck\n}\n"


def bundle(entries, compression=zipfile.ZIP_DEFLATED):
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w", compression=compression) as target:
        for name, data in entries:
            target.writestr(name, data)
    return out.getvalue()


def inspect(entries):
    return assess_controlled_zip_game_hints(bundle(entries))


class ControlledFixtureGameHintsTests(unittest.TestCase):
    def test_omsi_pair_in_one_vehicle_folder_is_only_a_fixture_candidate(self):
        result = inspect([
            ("Vehicles/A/A.bus", BUS),
            ("Vehicles/A/model/model.cfg", CFG),
            ("Vehicles/A/model/body.o3d", b"fake model"),
            ("Vehicles/A/body.dds", b"fake"),
        ])
        self.assertEqual(result["assessment"], "omsi-fixture-candidate")
        self.assertEqual(result["omsiPairedVehicleFolderCount"], 1)
        self.assertEqual(result["omsiLinkedVehicleFolderCount"], 1)
        self.assertEqual(result["omsiMeshLinkedVehicleFolderCount"], 1)
        self.assertEqual(result["omsiLinkedWithoutMeshFolderCount"], 0)
        self.assertEqual(result["omsiUnlinkedPairedFolderCount"], 0)
        self.assertEqual(result["omsiBusMarkerFolderCount"], 1)
        self.assertEqual(result["omsiCfgMarkerFolderCount"], 1)
        self.assertTrue(result["zipCrcChecked"])
        self.assertTrue(result["zipBytesReadInMemory"])
        for name in ("evidenceAuthenticated", "gameRecognized", "realModInspected",
                     "compatibilityVerified", "installationEnabled",
                     "realGameFilesTouched"):
            self.assertFalse(result[name])

    def test_bus_and_cfg_markers_from_different_vehicle_folders_are_not_independent_pair(self):
        result = inspect([
            ("Vehicles/A/a.bus", BUS),
            ("Vehicles/B/model/model.cfg", CFG),
        ])
        self.assertEqual(result["assessment"], "insufficient-omsi-fixture-evidence")
        self.assertEqual(result["omsiPairedVehicleFolderCount"], 0)

    def test_one_bus_marker_without_cfg_never_identifies_game(self):
        result = inspect([("Vehicles/A/model.bus", BUS)])
        self.assertEqual(result["assessment"], "insufficient-omsi-fixture-evidence")
        self.assertEqual(result["omsiBusMarkerFolderCount"], 1)

    def test_only_cfg_marker_without_bus_is_insufficient(self):
        result = inspect([("Vehicles/A/model/model.cfg", CFG)])
        self.assertEqual(result["assessment"], "insufficient-omsi-fixture-evidence")

    def test_one_valid_sii_marker_remains_ets2_vs_ats_ambiguous(self):
        result = inspect([
            ("def/vehicle/truck.sii", SII),
            ("mod/truck_ats.scs", b"not a real mod"),
        ])
        self.assertEqual(result["assessment"], "ets2-ats-shared-format-ambiguous")
        self.assertEqual(result["truckSiiMarkerCount"], 1)
        self.assertFalse(result["gameRecognized"])

    def test_omsi_pair_and_sii_marker_in_same_zip_never_choose_destination(self):
        result = inspect([
            ("Vehicles/A/A.bus", BUS), ("Vehicles/A/model/model.cfg", CFG),
            ("Vehicles/A/model/body.o3d", b"fake model"),
            ("def/vehicle.sii", SII)
        ])
        self.assertEqual(result["assessment"], "mixed-markers-ambiguous")
        self.assertEqual(result["omsiPairedVehicleFolderCount"], 1)
        self.assertEqual(result["truckSiiMarkerCount"], 1)

    def test_scs_suffix_and_filename_do_not_identify_truck_game(self):
        result = inspect([
            ("mod/Truck_ats.scs", b"not-a-real-scs"),
            ("vehicles/truck_ets2.bus", b"not a real bus definition"),
        ])
        self.assertEqual(result["assessment"], "no-recognizable-fixture-evidence")

    def test_fake_sii_without_balanced_braces_produces_no_truck_signal(self):
        result = inspect([("def/vehicle.sii", b"SiiNunit\n{\nvehicle : demo.truck\n")])
        self.assertEqual(result["assessment"], "no-recognizable-fixture-evidence")

    def test_unreadable_bus_bytes_do_not_contribute_a_marker(self):
        result = inspect([
            ("Vehicles/A/a.bus", b"\xff\x00\xfd"),
            ("Vehicles/A/model.cfg", CFG)
        ])
        self.assertEqual(result["assessment"], "insufficient-omsi-fixture-evidence")
        self.assertEqual(result["omsiBusMarkerFolderCount"], 0)

    def test_root_other_than_vehicles_does_not_count_as_omsi_pair(self):
        result = inspect([
            ("Other/A/a.bus", BUS), ("Other/A/model.cfg", CFG)
        ])
        self.assertEqual(result["assessment"], "no-recognizable-fixture-evidence")

    def test_requires_a_variant_subfolder_not_top_level_vehicles_names(self):
        result = inspect([
            ("Vehicles/a.bus", BUS), ("Vehicles/model.cfg", CFG)
        ])
        self.assertEqual(result["assessment"], "no-recognizable-fixture-evidence")

    def test_multiple_files_same_variant_count_once_and_other_variant_separately(self):
        result = inspect([
            ("Vehicles/A/a.bus", BUS), ("Vehicles/A/other.bus", BUS),
            ("Vehicles/A/model.cfg", CFG), ("Vehicles/A/other.cfg", CFG),
            ("Vehicles/B/b.bus", BUS), ("Vehicles/B/model.cfg", CFG),
        ])
        self.assertEqual(result["omsiPairedVehicleFolderCount"], 2)
        self.assertEqual(result["omsiBusMarkerFolderCount"], 2)
        self.assertEqual(result["omsiCfgMarkerFolderCount"], 2)

    def test_no_paths_original_names_or_payloads_in_output(self):
        result = inspect([
            ("Vehicles/PrivateOwner87654/PersonalBus982.bus", BUS),
            ("Vehicles/PrivateOwner87654/model/PrivateConfig.cfg", CFG),
        ])
        serialized = json.dumps(result)
        for private in ("PrivateOwner", "PersonalBus", "PrivateConfig",
                        "Synthetic Model", "body.o3d", "Vehicles/"):
            self.assertNotIn(private, serialized)

    def test_traversal_zip_is_refused_before_publishing_any_aggregate(self):
        with self.assertRaises(ControlledZipRefused):
            inspect([
                ("Vehicles/A/a.bus", BUS),
                ("../private.txt", b"secret"),
                ("Vehicles/A/model.cfg", CFG),
            ])

    def test_symlink_zip_is_refused_without_extraction(self):
        out = io.BytesIO()
        with zipfile.ZipFile(out, "w") as zf:
            link = zipfile.ZipInfo("Vehicles/A/link")
            link.create_system = 3
            link.external_attr = (stat.S_IFLNK | 0o777) << 16
            zf.writestr(link, b"../../private")
        with self.assertRaises(ControlledZipRefused):
            assess_controlled_zip_game_hints(out.getvalue())

    def test_zip_bomb_declared_expansion_is_refused(self):
        large = bundle([("Vehicles/A/oversized.bus", b"0" * 80000)])
        with self.assertRaises(ControlledZipRefused):
            assess_controlled_zip_game_hints(large)

    def test_caller_must_pass_immutable_bytes_not_paths_or_mutable_buffers(self):
        for bad in ("/home/user/a.zip", bytearray(b"PK"), None, {}):
            with self.subTest(kind=type(bad).__name__):
                with self.assertRaises(ControlledZipRefused):
                    assess_controlled_zip_game_hints(bad)

    def test_unrelated_cfg_in_same_variant_no_longer_produces_candidate(self):
        result = inspect([
            ("Vehicles/A/A.bus", BUS),
            ("Vehicles/A/other.cfg", CFG),
        ])
        self.assertEqual(result["omsiPairedVehicleFolderCount"], 1)
        self.assertEqual(result["omsiLinkedVehicleFolderCount"], 0)
        self.assertEqual(result["omsiUnlinkedPairedFolderCount"], 1)
        self.assertEqual(result["assessment"], "unlinked-omsi-fixture-markers")

    def test_model_reference_must_point_to_marked_cfg_not_only_matching_name(self):
        result = inspect([
            ("Vehicles/A/A.bus", BUS),
            ("Vehicles/A/model/model.cfg", b"not a model config"),
        ])
        self.assertEqual(result["omsiPairedVehicleFolderCount"], 0)
        self.assertEqual(result["omsiLinkedVehicleFolderCount"], 0)
        self.assertEqual(result["assessment"], "insufficient-omsi-fixture-evidence")

    def test_sound_reference_to_cfg_is_not_model_reference(self):
        result = inspect([
            ("Vehicles/A/A.bus", b"[friendlyname]\nDemo\n[sound]\nmodel/model.cfg\n"),
            ("Vehicles/A/model/model.cfg", CFG),
        ])
        self.assertEqual(result["omsiPairedVehicleFolderCount"], 1)
        self.assertEqual(result["omsiLinkedVehicleFolderCount"], 0)
        self.assertEqual(result["assessment"], "unlinked-omsi-fixture-markers")

    def test_unsafe_traversal_in_model_reference_cannot_create_link(self):
        result = inspect([
            ("Vehicles/A/A.bus", b"[friendlyname]\nDemo\n[model]\n../B/model.cfg\n"),
            ("Vehicles/A/model/model.cfg", CFG),
        ])
        self.assertEqual(result["omsiPairedVehicleFolderCount"], 1)
        self.assertEqual(result["omsiLinkedVehicleFolderCount"], 0)
        self.assertEqual(result["assessment"], "unlinked-omsi-fixture-markers")

    def test_reference_to_another_variant_does_not_count_as_local_link(self):
        result = inspect([
            ("Vehicles/A/A.bus", b"[model]\nmodel/model.cfg\n"),
            ("Vehicles/A/other.cfg", CFG),
            ("Vehicles/B/model/model.cfg", CFG),
        ])
        self.assertEqual(result["omsiLinkedVehicleFolderCount"], 0)
        self.assertEqual(result["omsiUnlinkedPairedFolderCount"], 1)
        self.assertEqual(result["assessment"], "unlinked-omsi-fixture-markers")

    def test_casefolded_fixture_paths_support_same_variant_model_reference(self):
        result = inspect([
            ("VEHICLES/MyBus/BUS.BUS",
             b"[friendlyname]\nBus\n[MODEL]\nMODEL\\body.CFG\n"),
            ("Vehicles/MyBus/Model/Body.cfg", CFG),
            ("Vehicles/MyBus/Model/body.o3d", b"fake"),
        ])
        self.assertEqual(result["assessment"], "omsi-fixture-candidate")
        self.assertEqual(result["omsiLinkedVehicleFolderCount"], 1)

    def test_multiple_links_same_folder_count_once_and_unlinked_folders_remain_visible(self):
        result = inspect([
            ("Vehicles/A/a.bus", BUS),
            ("Vehicles/A/b.bus", BUS),
            ("Vehicles/A/model/model.cfg", CFG),
            ("Vehicles/A/model/body.o3d", b"fake"),
            ("Vehicles/B/a.bus", BUS),
            ("Vehicles/B/different.cfg", CFG),
        ])
        self.assertEqual(result["omsiPairedVehicleFolderCount"], 2)
        self.assertEqual(result["omsiLinkedVehicleFolderCount"], 1)
        self.assertEqual(result["omsiUnlinkedPairedFolderCount"], 1)
        self.assertEqual(result["assessment"], "omsi-fixture-candidate")

    def test_link_report_never_exposes_private_paths_or_referenced_content(self):
        result = inspect([
            ("Vehicles/PrivateVariant9/BusName907.bus",
             b"[model]\nprivate/PrivateCfg227.cfg\n"),
            ("Vehicles/PrivateVariant9/private/PrivateCfg227.cfg", CFG),
            ("Vehicles/PrivateVariant9/private/body.o3d", b"fake"),
        ])
        self.assertEqual(result["omsiLinkedVehicleFolderCount"], 1)
        self.assertEqual(result["omsiMeshLinkedVehicleFolderCount"], 1)
        printed = json.dumps(result)
        for private in ("PrivateVariant9", "BusName907", "PrivateCfg227",
                        "private/", "Vehicles/", "model/model.cfg"):
            self.assertNotIn(private, printed)

    def test_oversized_reference_source_cannot_be_linked(self):
        # STORED stays within ZIP expansion-ratio limits so this test isolates
        # the bounded text-sample rule, not the existing anti-zip-bomb gate.
        bus = BUS + b"x" * 18000
        result = assess_controlled_zip_game_hints(bundle([
            ("Vehicles/A/A.bus", bus),
            ("Vehicles/A/model/model.cfg", CFG),
        ], compression=zipfile.ZIP_STORED))
        self.assertEqual(result["omsiLinkedVehicleFolderCount"], 0)
        self.assertEqual(result["assessment"], "insufficient-omsi-fixture-evidence")


    def test_linked_cfg_missing_o3d_is_not_promoted_to_candidate(self):
        result = inspect([
            ("Vehicles/A/A.bus", BUS),
            ("Vehicles/A/model/model.cfg", CFG),
        ])
        self.assertEqual(result["omsiLinkedVehicleFolderCount"], 1)
        self.assertEqual(result["omsiMeshLinkedVehicleFolderCount"], 0)
        self.assertEqual(result["omsiLinkedWithoutMeshFolderCount"], 1)
        self.assertEqual(result["assessment"], "omsi-model-mesh-unconfirmed")

    def test_o3d_only_in_another_variant_is_not_mesh_evidence(self):
        result = inspect([
            ("Vehicles/A/A.bus", BUS),
            ("Vehicles/A/model/model.cfg", CFG),
            ("Vehicles/B/model/body.o3d", b"fake"),
        ])
        self.assertEqual(result["omsiMeshLinkedVehicleFolderCount"], 0)
        self.assertEqual(result["assessment"], "omsi-model-mesh-unconfirmed")

    def test_cfg_texture_marker_cannot_substitute_mesh_reference(self):
        result = inspect([
            ("Vehicles/A/A.bus", BUS),
            ("Vehicles/A/model/model.cfg", b"[texture]\nbody.o3d\n"),
            ("Vehicles/A/model/body.o3d", b"fake"),
        ])
        self.assertEqual(result["omsiLinkedVehicleFolderCount"], 1)
        self.assertEqual(result["omsiMeshLinkedVehicleFolderCount"], 0)
        self.assertEqual(result["assessment"], "omsi-model-mesh-unconfirmed")

    def test_cfg_unsafe_mesh_traversal_does_not_pass(self):
        result = inspect([
            ("Vehicles/A/A.bus", BUS),
            ("Vehicles/A/model/model.cfg", b"[mesh]\n../body.o3d\n"),
            ("Vehicles/A/model/body.o3d", b"fake"),
        ])
        self.assertEqual(result["omsiMeshLinkedVehicleFolderCount"], 0)
        self.assertEqual(result["assessment"], "omsi-model-mesh-unconfirmed")

    def test_cfg_mesh_reference_casefold_and_backslash_is_accepted_in_fixture(self):
        result = inspect([
            ("Vehicles/BigBus/BigBus.bus", BUS),
            ("Vehicles/BigBus/Model/Model.cfg", b"[MESH]\nBODY" + bytes([92]) + b"one.O3D\n"),
            ("Vehicles/BigBus/Model/body/one.o3d", b"fake"),
        ])
        self.assertEqual(result["omsiMeshLinkedVehicleFolderCount"], 1)
        self.assertEqual(result["assessment"], "omsi-fixture-candidate")

    def test_same_variant_with_wrong_cfg_target_does_not_borrow_another_mesh(self):
        result = inspect([
            ("Vehicles/A/A.bus", BUS),
            ("Vehicles/A/model/model.cfg", CFG),
            ("Vehicles/A/unused.cfg", b"[mesh]\nbody.o3d\n"),
            ("Vehicles/A/body.o3d", b"fake"),
        ])
        self.assertEqual(result["omsiLinkedVehicleFolderCount"], 1)
        self.assertEqual(result["omsiMeshLinkedVehicleFolderCount"], 0)
        self.assertEqual(result["assessment"], "omsi-model-mesh-unconfirmed")

    def test_two_mesh_chains_in_one_variant_count_only_once(self):
        result = inspect([
            ("Vehicles/A/A.bus", BUS),
            ("Vehicles/A/B.bus", BUS),
            ("Vehicles/A/model/model.cfg", CFG),
            ("Vehicles/A/model/body.o3d", b"fake"),
        ])
        self.assertEqual(result["omsiMeshLinkedVehicleFolderCount"], 1)
        self.assertEqual(result["omsiLinkedWithoutMeshFolderCount"], 0)

    def test_fully_linked_chain_remains_ambiguous_with_truck_marker(self):
        result = inspect([
            ("Vehicles/A/A.bus", BUS),
            ("Vehicles/A/model/model.cfg", CFG),
            ("Vehicles/A/model/body.o3d", b"fake"),
            ("def/vehicle.sii", SII),
        ])
        self.assertEqual(result["omsiMeshLinkedVehicleFolderCount"], 1)
        self.assertEqual(result["assessment"], "mixed-markers-ambiguous")
        self.assertFalse(result["gameRecognized"])

    def test_mesh_chain_result_does_not_return_paths_or_mesh_payload(self):
        result = inspect([
            ("Vehicles/Personal999/BusSecret.bus", b"[model]\nmodel/PrivateCFG.cfg\n"),
            ("Vehicles/Personal999/model/PrivateCFG.cfg", b"[mesh]\nSecretMesh.o3d\n"),
            ("Vehicles/Personal999/model/SecretMesh.o3d", b"private bytes"),
        ])
        self.assertEqual(result["omsiMeshLinkedVehicleFolderCount"], 1)
        text = json.dumps(result)
        for private in ("Personal999", "BusSecret", "PrivateCFG",
                        "SecretMesh", "private bytes", "Vehicles/"):
            self.assertNotIn(private, text)


if __name__ == "__main__":
    unittest.main()
