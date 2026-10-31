"""Synthetic, offline regression suite for cross-platform package parity."""
import hashlib
import io
import json
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest
import zipfile

sys.path.insert(0, str(Path(__file__).parent))
from portable_pair_audit import AuditRefused, verify_pair, LINUX_ROOT, WINDOWS_ROOT, MANIFEST

SHA = "a" * 40


def metadata(platform, revision=SHA):
    return {
        "schemaVersion": 1, "product": "OMSI Manager Preview",
        "operatingSystem": platform, "architecture": "x64",
        "sourceRevision": revision, "buildEnvironment": "github-actions",
        "mode": "read-only", "modificationEnabled": False,
        "signatureStatus": "unsigned",
    }


class PairTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory(prefix="omsi-ci-pair-test-")
        self.addCleanup(self.dir.cleanup)
        root = Path(self.dir.name)
        self.linux = root / "linux"
        self.windows = root / "windows"
        self.linux.mkdir()
        self.windows.mkdir()

    def archives(self, linux_manifest=None, windows_manifest=None,
                 zip_bad_path=False, tar_symlink=False):
        lpath = self.linux / "OMSI-Manager-Preview-Linux-x64.tar.gz"
        wpath = self.windows / "OMSI-Manager-Preview-Windows-x64.zip"
        lm = json.dumps(linux_manifest or metadata("linux")).encode()
        wm = json.dumps(windows_manifest or metadata("windows")).encode()
        with tarfile.open(lpath, "w:gz") as tf:
            for name, data in [
                (LINUX_ROOT + "/" + MANIFEST, lm),
                (LINUX_ROOT + "/resources/app.asar", b"FAKE ASAR"),
                (LINUX_ROOT + "/OMSI-Manager-Preview", b"FAKE ELF"),
                (LINUX_ROOT + "/OMSI-Manager-Auto", b"FAKE ELF"),
            ]:
                info = tarfile.TarInfo(name)
                info.size = len(data)
                tf.addfile(info, io.BytesIO(data))
            if tar_symlink:
                link = tarfile.TarInfo(LINUX_ROOT + "/external")
                link.type = tarfile.SYMTYPE
                link.linkname = "../../private"
                tf.addfile(link)
        with zipfile.ZipFile(wpath, "w") as zf:
            zf.writestr(WINDOWS_ROOT + "/" + MANIFEST, wm)
            zf.writestr(WINDOWS_ROOT + "/resources/app.asar", b"FAKE ASAR")
            zf.writestr(WINDOWS_ROOT + "/OMSI-Manager-Preview.exe", b"FAKE PE")
            if zip_bad_path:
                zf.writestr(WINDOWS_ROOT + "/../steal.txt", "not allowed")
        for path in (lpath, wpath):
            name = path.name.replace(".tar.gz", "").replace(".zip", "") + ".sha256"
            (path.parent / name).write_text(
                hashlib.sha256(path.read_bytes()).hexdigest()
                + "  " + path.name + "\n", encoding="ascii"
            )
        return lpath, wpath

    def test_same_source_commit_on_two_distinct_native_platforms(self):
        self.archives()
        verify_pair(self.linux, self.windows, SHA)

    def test_mismatched_source_revision_is_refused(self):
        self.archives(windows_manifest=metadata("windows", "b" * 40))
        with self.assertRaises(AuditRefused):
            verify_pair(self.linux, self.windows, SHA)

    def test_advisory_manifest_cannot_claim_write_permission(self):
        bad = metadata("linux")
        bad["modificationEnabled"] = True
        self.archives(linux_manifest=bad)
        with self.assertRaises(AuditRefused):
            verify_pair(self.linux, self.windows, SHA)

    def test_malformed_checksum_is_refused(self):
        self.archives()
        (self.windows / "OMSI-Manager-Preview-Windows-x64.sha256").write_text(
            "NOT A SHA256", encoding="ascii"
        )
        with self.assertRaises(AuditRefused):
            verify_pair(self.linux, self.windows, SHA)

    def test_unsafe_zip_path_is_refused_without_extracting(self):
        self.archives(zip_bad_path=True)
        with self.assertRaises(AuditRefused):
            verify_pair(self.linux, self.windows, SHA)

    def test_unsafe_tar_symlink_is_refused_without_extracting(self):
        self.archives(tar_symlink=True)
        with self.assertRaises(AuditRefused):
            verify_pair(self.linux, self.windows, SHA)


if __name__ == "__main__":
    unittest.main()
