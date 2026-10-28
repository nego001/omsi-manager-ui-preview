"""Independent fixture-group contracts, no input ZIP file paths."""
import json
import unittest

from controlled_zip_reader import ControlledZipRefused
from controlled_fixture_group import examine_fixture_group
from test_controlled_zip_reader import bundle

class FixtureGroupTests(unittest.TestCase):
    def test_cross_zip_reference_is_only_an_unverified_candidate(self):
        first = bundle([
            ("Vehicles/Demo/demo.bus",
             b"[model]\nmodel.cfg\n[sound]\nsound.cfg\n"
             b"[model]\nmissing.cfg\n[mesh]\nbody.o3d\n"),
            ("Vehicles/Demo/sound.cfg", b"[mesh]\nengine.o3d\n"),
        ])
        second = bundle([
            ("Vehicles/Demo/model.cfg",
             b"[mesh]\nbody.o3d\n[texture]\nbody.dds\n"),
            ("Vehicles/Demo/body.o3d", b"not a real OMSI model"),
            ("Vehicles/Demo/body.dds", b"not a real texture"),
        ])
        result = examine_fixture_group((first, second))
        self.assertEqual(result["fixtureCount"], 2)
        self.assertEqual(result["mode"], "memory-fixture-cross-check-only")
        original = result["slots"][0]["hints"]
        self.assertEqual(original["model"], {
            "declared": 2, "insideOwnFixture": 0,
            "candidateInOtherFixture": 1, "notFoundInProvidedFixtures": 1,
            "unsafePath": 0, "unsupportedHint": 0
        })
        self.assertEqual(original["sound"]["insideOwnFixture"], 1)
        self.assertEqual(original["mesh"]["candidateInOtherFixture"], 1)
        second_hints = result["slots"][1]["hints"]
        self.assertEqual(second_hints["mesh"]["insideOwnFixture"], 1)
        self.assertEqual(second_hints["texture"]["insideOwnFixture"], 1)
        for key in ("realPackagesRead", "realDependenciesVerified",
                    "crossPackageCandidatesVerified", "gameCompatibilityVerified",
                    "installationEnabled", "filesystemAccessEnabled"):
            self.assertFalse(result[key])

    def test_different_paths_and_wrong_suffix_do_not_create_fake_candidates(self):
        first = bundle([("A/bus.bus",
                         b"[model]\nmodel.cfg\n[mesh]\nbody.o3d\n"
                         b"[model]\nmodel.txt\n")])
        second = bundle([
            ("B/model.cfg", b"test"),
            ("B/body.o3d", b"test"),
            ("A/model.txt", b"test"),
        ])
        report = examine_fixture_group((first, second))
        hints = report["slots"][0]["hints"]
        self.assertEqual(hints["model"]["candidateInOtherFixture"], 0)
        self.assertEqual(hints["model"]["notFoundInProvidedFixtures"], 1)
        self.assertEqual(hints["model"]["unsupportedHint"], 1)
        self.assertEqual(hints["mesh"]["notFoundInProvidedFixtures"], 1)

    def test_unsafe_references_cannot_be_satisfied_by_a_second_zip(self):
        first = bundle([("A/bus.bus",
                         b"[model]\n../../private.cfg\n"
                         b"[sound]\nhttps://malicious.example/sound.cfg\n")])
        second = bundle([("A/private.cfg", b"test"), ("A/sound.cfg", b"test")])
        report = examine_fixture_group((first, second))
        hints = report["slots"][0]["hints"]
        self.assertEqual(hints["model"]["unsafePath"], 1)
        self.assertEqual(hints["sound"]["unsafePath"], 1)
        self.assertEqual(hints["model"]["candidateInOtherFixture"], 0)
        self.assertEqual(hints["sound"]["candidateInOtherFixture"], 0)

    def test_large_definition_is_uninspected_not_marked_missing(self):
        first = bundle([("A/bus.bus", b"[model]\nmissing.cfg\n" + b"x" * 17_000)])
        second = bundle([("A/unused.cfg", b"[mesh]\nmesh.o3d\n")])
        result = examine_fixture_group((first, second))
        self.assertEqual(result["slots"][0]["inspectedDefinitionSources"], 0)
        self.assertEqual(result["slots"][0]["notInspectedDefinitionSources"], 1)
        self.assertEqual(result["slots"][0]["hints"]["model"]["declared"], 0)

    def test_rejected_or_untrusted_package_rejects_whole_group(self):
        valid = bundle([("A/test.bus", b"[model]\nmodel.cfg\n")])
        bad = bundle([("../traversal.cfg", b"bad")])
        for payloads in (
            (valid, bad), (bad, valid), (valid, b"not ZIP"),
            (valid, valid, valid, valid, valid), (valid,),
            [valid, valid], (valid, "/game/mod.zip"), (valid, bytearray(valid)),
            (valid, valid, valid, b"x" * 2_000_001),
        ):
            with self.subTest(kind=str(type(payloads))):
                with self.assertRaises(ControlledZipRefused):
                    examine_fixture_group(payloads)

    def test_aggregate_output_never_exposes_filename_or_text(self):
        first = bundle([("SECRET_345/sensitive_bus.bus",
                         b"[model]\nSECRET_345_MODEL.cfg\n")])
        second = bundle([("SECRET_345/SECRET_345_MODEL.cfg", b"private text")])
        report = examine_fixture_group((first, second))
        self.assertEqual(report["slots"][0]["hints"]["model"]
                         ["candidateInOtherFixture"], 1)
        serialized = json.dumps(report)
        for secret in ("SECRET_345", "sensitive_bus", "private text",
                       "SECRET_345_MODEL.cfg", "A/bus.bus"):
            self.assertNotIn(secret, serialized)

    def test_aggregate_invariants_and_total_declarations(self):
        a = bundle([("A/bus.bus",
                     b"[model]\nmodel.cfg\n[model]\nunknown.cfg\n"
                     b"[sound]\nsound.cfg\n")])
        b = bundle([("A/model.cfg", b"[mesh]\nbody.o3d\n")])
        c = bundle([("A/body.o3d", b"dummy bytes")])
        result = examine_fixture_group((a, b, c))
        self.assertEqual(result["declaredHintCount"], 4)
        for slot in result["slots"]:
            for kind in slot["hints"].values():
                self.assertEqual(kind["declared"],
                                 kind["insideOwnFixture"] +
                                 kind["candidateInOtherFixture"] +
                                 kind["notFoundInProvidedFixtures"] +
                                 kind["unsafePath"] + kind["unsupportedHint"])


    def test_react_fixture_example_numbers_match_python_zip_reader(self):
        """UI numbers must match real in-memory ZIP fixture results, no drift."""
        from pathlib import Path
        fixture_path = Path(__file__).resolve().parents[1] / (
            "src/fixture-cross-package-examples.json")
        examples = json.loads(fixture_path.read_text(encoding="utf-8"))
        cases = {
            "matched": (
                bundle([
                    ("Vehicles/demo.bus",
                     b"[model]\nmodel.cfg\n[sound]\nsound.cfg\n"),
                    ("Vehicles/sound.cfg", b"fixture-only"),
                ]),
                bundle([("Vehicles/model.cfg", b"fixture-only")]),
            ),
            "absent": (
                bundle([
                    ("Vehicles/demo.bus",
                     b"[model]\nmodel.cfg\n[sound]\nsound.cfg\n"),
                ]),
                bundle([("Vehicles/unrelated.cfg", b"fixture-only")]),
            ),
            "unsafe": (
                bundle([
                    ("Vehicles/demo.bus",
                     b"[model]\n../../secret.cfg\n"
                     b"[mesh]\nhttp://example.invalid/fake.o3d\n"
                     b"[model]\nnot-a-cfg.txt\n"),
                ]),
                bundle([("Vehicles/secret.cfg", b"fixture-only")]),
            ),
        }
        self.assertEqual([e["id"] for e in examples],
                         ["matched", "absent", "unsafe"])
        self.assertEqual(set(cases), {e["id"] for e in examples})
        for entry in examples:
            report = examine_fixture_group(cases[entry["id"]])
            categories = {
                "declared": 0, "withinOwn": 0, "otherCandidate": 0,
                "unresolved": 0, "unsafe": 0, "unsupported": 0
            }
            for slot in report["slots"]:
                for counts in slot["hints"].values():
                    for item, source_key in (
                        ("declared", "declared"),
                        ("withinOwn", "insideOwnFixture"),
                        ("otherCandidate", "candidateInOtherFixture"),
                        ("unresolved", "notFoundInProvidedFixtures"),
                        ("unsafe", "unsafePath"),
                        ("unsupported", "unsupportedHint"),
                    ):
                        categories[item] += counts[source_key]
            self.assertEqual(report["fixtureCount"], entry["fixtureCount"])
            for item, actual in categories.items():
                self.assertEqual(actual, entry[item],
                                 f"UI fixture {entry['id']} mismatch: {item}")
            self.assertFalse(report["realPackagesRead"])
            self.assertFalse(report["installationEnabled"])

if __name__ == "__main__":
    unittest.main()
