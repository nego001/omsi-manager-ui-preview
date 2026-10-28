"""Linux-only adversarial tests for real disposable files, not user mods."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from controlled_ci_group_fd_reader import (
    ControlledCiGroupFdRefused, inspect_open_fixture_group_fds,
)
from controlled_zip_reader import MAX_ARCHIVE_BYTES
from test_controlled_zip_reader import bundle
from test_controlled_ci_file_reader import open_fixture

WORKER = str(Path(__file__).with_name("controlled_ci_group_fd_reader.py"))


def invoke(*fds):
    return subprocess.run(
        [sys.executable, "-I", "-S", "-B", WORKER, "--fixture-fds",
         *(str(fd) for fd in fds)],
        pass_fds=fds, cwd="/",
        env={"PYTHONIOENCODING": "utf-8"},
        capture_output=True, text=True, timeout=8, check=False,
    )


@unittest.skipUnless(sys.platform.startswith("linux"), "Linux FD laboratory only")
class ControlledCiGroupFdReaderTests(unittest.TestCase):
    def test_multiple_real_disposable_zips_produce_anonymous_slot_evidence(self):
        payloads = [
            bundle([("Vehicles/Demo/private-123.bus",
                     b"[model]\nmodel.cfg\n[mesh]\nbody.o3d\n"
                     b"[texture]\nmissing.dds\n")]),
            bundle([("Vehicles/Demo/model.cfg", b"fake fixture"),
                    ("Vehicles/Demo/body.o3d", b"fake geometry")]),
            bundle([("Vehicles/Demo/model.cfg", b"another invented fixture")]),
        ]
        with tempfile.TemporaryDirectory(prefix="ci-group-fds-") as root:
            paths = [Path(root) / f"private-package-{i}.zip"
                     for i in range(len(payloads))]
            for path, payload in zip(paths, payloads):
                path.write_bytes(payload)
                path.chmod(0o600)
            before = [(p.stat().st_size, p.stat().st_mtime_ns)
                      for p in paths]
            fds = tuple(open_fixture(path) for path in paths)
            try:
                result = invoke(*fds)
            finally:
                for fd in fds:
                    os.close(fd)
            self.assertEqual(result.returncode, 0, result.stderr[:120])
            self.assertEqual(result.stderr, "")
            envelope = json.loads(result.stdout)
            report = envelope["report"]
            self.assertEqual(envelope["inputCount"], 3)
            self.assertEqual(report["fixtureCount"], 3)
            self.assertEqual(len(report["slots"]), 3)
            self.assertEqual(report["slots"][0]["fixtureSlot"], 1)
            first = report["slots"][0]["hints"]
            self.assertEqual(first["model"]["ambiguousAcrossFixtures"], 1)
            self.assertEqual(first["mesh"]["candidateInOtherFixture"], 1)
            self.assertEqual(first["texture"]["notFoundInProvidedFixtures"], 1)
            self.assertEqual(report["declaredHintCount"], 3)
            for flag in ("osSandboxVerified", "fdOriginAuthenticated",
                         "realUserModsInspected", "gameCompatibilityVerified",
                         "installationEnabled", "writesPerformed"):
                self.assertFalse(envelope[flag])
            self.assertFalse(report["realPackagesRead"])
            self.assertFalse(report["filesystemAccessEnabled"])
            self.assertEqual([p.read_bytes() for p in paths], payloads)
            self.assertEqual([(p.stat().st_size, p.stat().st_mtime_ns)
                              for p in paths], before)
            self.assertEqual(set(os.listdir(root)),
                             {p.name for p in paths})
            for secret in ("private-package", "private-123",
                           "fake geometry", "missing.dds", root):
                self.assertNotIn(secret, result.stdout)

    def test_invalid_fds_and_duplicate_file_identity_fail_closed(self):
        with tempfile.TemporaryDirectory(prefix="ci-group-fds-") as root:
            p1 = Path(root) / "one.zip"
            p2 = Path(root) / "two.zip"
            p1.write_bytes(bundle([("a.bus", b"example")]))
            p2.write_bytes(bundle([("b.bus", b"example")]))
            fd1, fd2 = open_fixture(p1), open_fixture(p2)
            try:
                for wrong in ((fd1,), (fd1, fd1), [fd1, fd2],
                              (fd1, fd2, "/tmp/a.zip"), (fd1, 64),
                              (fd1, None), (fd1, 0), tuple(range(3, 8))):
                    with self.subTest(case=str(wrong)[:60]):
                        with self.assertRaises(ControlledCiGroupFdRefused):
                            inspect_open_fixture_group_fds(wrong)
                second_fd_same_inode = open_fixture(p1)
                try:
                    with self.assertRaises(ControlledCiGroupFdRefused):
                        inspect_open_fixture_group_fds((fd1, second_fd_same_inode))
                finally:
                    os.close(second_fd_same_inode)
                writable = os.open(p2, os.O_RDWR | os.O_NOFOLLOW | os.O_CLOEXEC)
                try:
                    bad = invoke(fd1, writable)
                finally:
                    os.close(writable)
                self.assertEqual(bad.returncode, 2)
                self.assertEqual(bad.stdout, "")
                self.assertEqual(bad.stderr.strip(),
                                 "CONTROLLED_CI_GROUP_FD_REFUSED")
            finally:
                os.close(fd1)
                os.close(fd2)

    def test_corrupt_or_oversized_file_refuses_entire_group(self):
        with tempfile.TemporaryDirectory(prefix="ci-group-fds-") as root:
            good = Path(root) / "good.zip"
            bad = Path(root) / "bad.zip"
            good.write_bytes(bundle([("a.bus", b"harmless")]))
            bad.write_bytes(bundle([("secret.bus", b"ORIGINAL")])
                            .replace(b"ORIGINAL", b"TAMPERED"))
            for payload in (None, b"x" * (MAX_ARCHIVE_BYTES + 1)):
                if payload is not None:
                    bad.write_bytes(payload)
                fds = tuple(open_fixture(p) for p in (good, bad))
                try:
                    result = invoke(*fds)
                finally:
                    for fd in fds:
                        os.close(fd)
                self.assertEqual(result.returncode, 2)
                self.assertEqual(result.stdout, "")
                self.assertEqual(result.stderr.strip(),
                                 "CONTROLLED_CI_GROUP_FD_REFUSED")
                self.assertNotIn("secret", result.stderr)

    def test_cli_never_accepts_host_path_or_uninherited_fds(self):
        for arg in ("/home/example/mod.zip", "../secret.zip", "3.0",
                    "-1", "999", "3x"):
            result = subprocess.run(
                [sys.executable, "-I", "-S", "-B", WORKER,
                 "--fixture-fds", "3", arg],
                cwd="/", env={"PYTHONIOENCODING": "utf-8"},
                capture_output=True, text=True, timeout=8, check=False,
            )
            self.assertEqual(result.returncode, 2)
            self.assertEqual(result.stdout, "")
            self.assertEqual(result.stderr.strip(),
                             "CONTROLLED_CI_GROUP_FD_REFUSED")


if __name__ == "__main__":
    unittest.main()
