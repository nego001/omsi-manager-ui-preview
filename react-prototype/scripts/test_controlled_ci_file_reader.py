"""Disposable actual-file FD tests. Linux CI only; no user mods."""
import errno
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from controlled_ci_file_reader import ControlledCiFdRefused, inspect_open_read_only_fixture_fd
from controlled_zip_reader import MAX_ARCHIVE_BYTES
from test_controlled_zip_reader import bundle

WORKER = str(Path(__file__).with_name("controlled_ci_file_reader.py"))

def open_fixture(path):
    return os.open(path, os.O_RDONLY | os.O_NOFOLLOW |
                   os.O_CLOEXEC | os.O_NONBLOCK)

def invoke(fd, diagnostic=False):
    # Only successful synthetic-file regression cases request fixed categories.
    env = {"PYTHONIOENCODING": "utf-8"}
    if diagnostic:
        env["CI_FD_LAB_DIAGNOSTIC"] = "1"
    return subprocess.run(
        [sys.executable, "-I", "-S", "-B", WORKER, "--fixture-fd", str(fd)],
        pass_fds=(fd,), cwd="/", env=env,
        capture_output=True, text=True, timeout=8, check=False
    )

@unittest.skipUnless(sys.platform.startswith("linux"), "Linux FD laboratory only")
class ControlledCiFileReaderTests(unittest.TestCase):
    def test_worker_reads_real_disposable_zip_file_without_modifying_it(self):
        with tempfile.TemporaryDirectory(prefix="ci-zip-fd-") as root:
            sample = Path(root) / "invented.zip"
            payload = bundle([
                ("Vehicles/fixture.bus", b"[model]\nmodel.cfg\n"),
                ("Vehicles/model.cfg", b"[mesh]\nmesh.o3d\n"),
                ("Vehicles/mesh.o3d", b"fictional geometry"),
            ])
            sample.write_bytes(payload)
            sample.chmod(0o600)
            before = sample.stat()
            fd = open_fixture(sample)
            try:
                result = invoke(fd, diagnostic=True)
            finally:
                os.close(fd)
            self.assertEqual(result.returncode, 0, result.stderr[:100])
            self.assertEqual(result.stderr, "")
            report = json.loads(result.stdout)
            self.assertEqual(report["inputSource"],
                             "ci-created-open-readonly-file-descriptor")
            self.assertTrue(report["inputRegularFile"])
            self.assertTrue(report["inputIdentityStableDuringRead"])
            self.assertEqual(report["zipReport"]["fileCount"], 3)
            self.assertEqual(report["zipReport"]["fixtureReferenceSources"]["inspected"], 2)
            self.assertEqual(report["zipReport"]["fixtureReferenceCounts"]
                             ["model"]["presentInFixture"], 1)
            self.assertFalse(report["osSandboxVerified"])
            self.assertFalse(report["realUserModsInspected"])
            self.assertFalse(report["installationEnabled"])
            self.assertFalse(report["writesPerformed"])
            self.assertFalse(report["zipReport"]["compatibilityVerified"])
            self.assertEqual(sample.read_bytes(), payload)
            self.assertEqual(before.st_size, sample.stat().st_size)
            self.assertEqual(before.st_mtime_ns, sample.stat().st_mtime_ns)
            self.assertEqual(os.listdir(root), ["invented.zip"])
            emitted = result.stdout
            self.assertNotIn(str(sample), emitted)
            self.assertNotIn("fixture.bus", emitted)
            self.assertNotIn("fictional geometry", emitted)

    def test_symlink_to_disposable_file_cannot_be_opened(self):
        with tempfile.TemporaryDirectory(prefix="ci-zip-fd-") as root:
            original = Path(root) / "origin.zip"
            original.write_bytes(bundle([("a.bus", b"[model]\nx.cfg\n")]))
            shortcut = Path(root) / "link.zip"
            shortcut.symlink_to(original)
            with self.assertRaises(OSError) as caught:
                fd = open_fixture(shortcut)
                os.close(fd)
            self.assertEqual(caught.exception.errno, errno.ELOOP)

    def test_direct_reader_rejects_non_regular_or_writable_fd(self):
        with tempfile.TemporaryDirectory(prefix="ci-zip-fd-") as root:
            name = Path(root) / "fixture.zip"
            name.write_bytes(bundle([("a.bus", b"fixture")]))
            write_fd = os.open(name, os.O_RDWR | os.O_NOFOLLOW | os.O_CLOEXEC)
            try:
                with self.assertRaises(ControlledCiFdRefused):
                    inspect_open_read_only_fixture_fd(write_fd)
            finally:
                os.close(write_fd)
            read_end, write_end = os.pipe()
            try:
                with self.assertRaises(ControlledCiFdRefused):
                    inspect_open_read_only_fixture_fd(read_end)
            finally:
                os.close(read_end)
                os.close(write_end)
            for wrong in ("/tmp/user.zip", 0, 1, 2, None, -1, 64):
                with self.subTest(fd=wrong):
                    with self.assertRaises(ControlledCiFdRefused):
                        inspect_open_read_only_fixture_fd(wrong)

    def test_oversized_and_crc_corrupt_fixture_are_refused(self):
        with tempfile.TemporaryDirectory(prefix="ci-zip-fd-") as root:
            name = Path(root) / "oversized.zip"
            name.write_bytes(b"x" * (MAX_ARCHIVE_BYTES + 1))
            fd = open_fixture(name)
            try:
                res = invoke(fd)
            finally:
                os.close(fd)
            self.assertEqual(res.returncode, 2)
            self.assertEqual(res.stdout, "")
            self.assertEqual(res.stderr.strip(), "CONTROLLED_CI_FD_REFUSED")

            payload = bundle([("private_secret.bus", b"ORIGINAL")])
            name.write_bytes(payload.replace(b"ORIGINAL", b"TAMPERED"))
            fd = open_fixture(name)
            try:
                bad = invoke(fd)
            finally:
                os.close(fd)
            self.assertEqual(bad.returncode, 2)
            self.assertEqual(bad.stdout, "")
            self.assertEqual(bad.stderr.strip(), "CONTROLLED_CI_FD_REFUSED")
            self.assertNotIn("private_secret", bad.stderr)

    def test_worker_rejects_inherited_writable_hardlinked_and_directory_fds(self):
        with tempfile.TemporaryDirectory(prefix="ci-zip-fd-") as root:
            path = Path(root) / "fixture.zip"
            path.write_bytes(bundle([("A/model.cfg", b"[mesh]\npart.o3d\n")]))
            writable = os.open(path, os.O_RDWR | os.O_CLOEXEC)
            try:
                result = invoke(writable)
                self.assertEqual((result.returncode, result.stdout, result.stderr.strip()),
                                 (2, "", "CONTROLLED_CI_FD_REFUSED"))
            finally:
                os.close(writable)
            link = Path(root) / "hardlink.zip"
            os.link(path, link)
            fd = open_fixture(path)
            try:
                result = invoke(fd)
                self.assertEqual((result.returncode, result.stdout, result.stderr.strip()),
                                 (2, "", "CONTROLLED_CI_FD_REFUSED"))
            finally:
                os.close(fd)
            os.unlink(link)
            directory_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_CLOEXEC)
            try:
                result = invoke(directory_fd)
                self.assertEqual((result.returncode, result.stdout, result.stderr.strip()),
                                 (2, "", "CONTROLLED_CI_FD_REFUSED"))
            finally:
                os.close(directory_fd)

    def test_worker_rejects_uninherited_numeric_fd_without_disclosing_host(self):
        result = subprocess.run(
            [sys.executable, "-I", "-S", "-B", WORKER, "--fixture-fd", "9"],
            cwd="/", env={"PYTHONIOENCODING": "utf-8"},
            capture_output=True, text=True, timeout=8, check=False
        )
        self.assertEqual((result.returncode, result.stdout, result.stderr.strip()),
                         (2, "", "CONTROLLED_CI_FD_REFUSED"))

    def test_pread_does_not_modify_the_shared_file_offset(self):
        with tempfile.TemporaryDirectory(prefix="ci-zip-fd-") as root:
            path = Path(root) / "offset.zip"
            data = bundle([("A/demo.bus", b"[model]\nmodel.cfg\n")])
            path.write_bytes(data)
            fd = open_fixture(path)
            try:
                os.lseek(fd, 7, os.SEEK_SET)
                result = invoke(fd, diagnostic=True)
                self.assertEqual(result.returncode, 0, result.stderr[:100])
                self.assertEqual(os.lseek(fd, 0, os.SEEK_CUR), 7)
                self.assertFalse(json.loads(result.stdout)["writesPerformed"])
            finally:
                os.close(fd)
            self.assertEqual(path.read_bytes(), data)

    def test_worker_requires_an_inherited_fd_and_never_accepts_a_path(self):
        bad = subprocess.run(
            [sys.executable, "-I", "-S", "-B", WORKER, "--fixture-fd",
             "/home/user/real-mod.zip"],
            cwd="/", env={"PYTHONIOENCODING": "utf-8"},
            capture_output=True, text=True, timeout=8, check=False
        )
        self.assertEqual(bad.returncode, 2)
        self.assertEqual(bad.stderr.strip(), "CONTROLLED_CI_FD_REFUSED")
        self.assertEqual(bad.stdout, "")

if __name__ == "__main__":
    unittest.main()
