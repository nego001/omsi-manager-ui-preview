"""Synthetic-only adversarial tests for the CI portable TAR header guard."""
import io
import tarfile
import unittest

from controlled_ci_archive_guard import (
    CiArchiveRefused, ROOT, MAX_FILE_BYTES, validate_fixture_stream,
    validate_tar_members
)


def archive_bytes(entries):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:gz", format=tarfile.PAX_FORMAT) as tar:
        for name, kind, body, mode, link in entries:
            info = tarfile.TarInfo(name)
            info.type = kind
            info.mode = mode
            info.linkname = link
            info.size = len(body) if kind == tarfile.REGTYPE else 0
            tar.addfile(info, io.BytesIO(body) if kind == tarfile.REGTYPE else None)
    return output.getvalue()


def valid_entries():
    return [
        (ROOT + "/", tarfile.DIRTYPE, b"", 0o755, ""),
        (ROOT + "/OMSI-Manager-Preview", tarfile.REGTYPE, b"\x7fELFmock-elf", 0o755, ""),
        (ROOT + "/OMSI-Manager-Auto", tarfile.REGTYPE, b"\x7fELFmock-launcher", 0o755, ""),
    ]


class CiLinuxArchiveGuardTests(unittest.TestCase):
    def assert_refused(self, entries):
        with self.assertRaisesRegex(
            CiArchiveRefused, "^CI_LINUX_ARCHIVE_HEADERS_REFUSED$"
        ):
            validate_fixture_stream(io.BytesIO(archive_bytes(entries)))

    def test_accepts_two_binaries_under_one_fixed_archive_root(self):
        report = validate_fixture_stream(io.BytesIO(archive_bytes(valid_entries())))
        self.assertEqual(report, {
            "verified": True,
            "scope": "ci-unsigned-archive-structure-elf-magic"
        })
        self.assertNotIn("OMSI-Manager-Preview", str(report))

    def test_rejects_traversal_absolute_windows_and_ambiguous_paths(self):
        for name in (
            ROOT + "/../escape", ROOT + "/foo/../../escape",
            ROOT + "/./foo", ROOT + "//foo",
            ROOT + "/foo//bar", ROOT + "/foo\\bar",
            "/tmp/evil", "outside-root/evil", ROOT + "/foo\nsecret",
            ROOT + "/foo\x7fbar", ROOT + "/foo" + "x" * 1025,
        ):
            with self.subTest(case=repr(name)[:80]):
                self.assert_refused(valid_entries() + [
                    (name, tarfile.REGTYPE, b"never extract", 0o644, "")
                ])

    def test_rejects_links_and_special_members_even_inside_root(self):
        for kind, link in (
            (tarfile.SYMTYPE, "../../etc/passwd"),
            (tarfile.SYMTYPE, ROOT + "/OMSI-Manager-Preview"),
            (tarfile.LNKTYPE, ROOT + "/OMSI-Manager-Preview"),
            (tarfile.CHRTYPE, ""), (tarfile.BLKTYPE, ""),
            (tarfile.FIFOTYPE, "")
        ):
            with self.subTest(kind=kind):
                self.assert_refused(valid_entries() + [
                    (ROOT + "/extra", kind, b"", 0o644, link)
                ])

    def test_rejects_duplicate_names_and_unsafe_permission_modes(self):
        self.assert_refused(valid_entries() + [valid_entries()[1]])
        for bad_mode in (0o4755, 0o2755):
            with self.subTest(mode=bad_mode):
                bad = valid_entries()
                bad[1] = (bad[1][0], bad[1][1], bad[1][2], bad_mode, "")
                self.assert_refused(bad)

    def test_rejects_executable_name_without_elf_magic(self):
        for index in (1, 2):
            for body in (b"#!/bin/sh", b"MZexecut", b"\x7fEL", b""):
                with self.subTest(executable_index=index, sample=repr(body)):
                    bad = valid_entries()
                    name, kind, _, mode, link = bad[index]
                    bad[index] = (name, kind, body, mode, link)
                    self.assert_refused(bad)

    def test_rejects_missing_required_binaries(self):
        self.assert_refused(valid_entries()[:2])

    def test_rejects_huge_declared_file_size_without_extracting(self):
        packed = io.BytesIO(archive_bytes(valid_entries()))
        with tarfile.open(fileobj=packed, mode="r:gz") as tar:
            giant = tarfile.TarInfo(ROOT + "/huge.bin")
            giant.size = MAX_FILE_BYTES + 1
            class Synthetic:
                def __iter__(self):
                    return iter([*list(tar), giant])
            with self.assertRaises(CiArchiveRefused):
                validate_tar_members(Synthetic())

    def test_rejects_root_missing_or_root_regular_file(self):
        no_root = valid_entries()[1:] + [
            (ROOT + "/resources/extra.bin", tarfile.REGTYPE, b"fake", 0o644, "")
        ]
        self.assert_refused(no_root)
        bad = valid_entries()
        bad[0] = (ROOT, tarfile.REGTYPE, b"not a directory", 0o755, "")
        self.assert_refused(bad)

    def test_rejects_executable_paths_that_are_directories(self):
        for index in (1, 2):
            with self.subTest(executable_index=index):
                bad = valid_entries()
                name, _, _, mode, _ = bad[index]
                bad[index] = (name + "/", tarfile.DIRTYPE, b"", mode, "")
                self.assert_refused(bad)

    def test_rejects_required_regular_files_without_execute_permission(self):
        for index in (1, 2):
            for mode in (0o644, 0o600, 0o400, 0):
                with self.subTest(executable_index=index, mode=mode):
                    bad = valid_entries()
                    name, kind, body, _, link = bad[index]
                    bad[index] = (name, kind, body, mode, link)
                    self.assert_refused(bad)

    def test_rejects_regular_file_as_parent_directory_in_any_order(self):
        ancestor = (ROOT + "/resources", tarfile.REGTYPE, b"parent-file", 0o644, "")
        child = (ROOT + "/resources/child", tarfile.REGTYPE, b"child", 0o644, "")
        self.assert_refused(valid_entries() + [ancestor, child])
        self.assert_refused(valid_entries() + [child, ancestor])
        # A directory ancestor is legitimate and has no conflict.
        good = valid_entries() + [
            (ROOT + "/resources/", tarfile.DIRTYPE, b"", 0o755, ""),
            child,
        ]
        self.assertTrue(validate_fixture_stream(io.BytesIO(archive_bytes(good)))["verified"])

    def test_rejects_corrupted_archive_data(self):
        with self.assertRaises(CiArchiveRefused):
            validate_fixture_stream(io.BytesIO(b"not a gzip archive"))


if __name__ == "__main__":
    unittest.main()
