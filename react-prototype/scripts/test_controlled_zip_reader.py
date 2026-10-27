"""Adversarial ZIP fixtures are constructed in memory; no user file access."""
import io
import stat
import unittest
import zipfile
from controlled_zip_reader import (
    ControlledZipRefused, MAX_ARCHIVE_BYTES, examine_controlled_zip_bytes
)

def bundle(entries, compression=zipfile.ZIP_STORED):
    mem = io.BytesIO()
    with zipfile.ZipFile(mem, "w", compression=compression) as zf:
        for name, data in entries:
            # Directory entries are intentionally stored, never deflated.
            # The constrained reader rejects compressed empty directory metadata.
            if name.endswith("/"):
                item = zipfile.ZipInfo(name)
                item.compress_type = zipfile.ZIP_STORED
                zf.writestr(item, data)
            else:
                zf.writestr(name, data)
    return mem.getvalue()

class ControlledZipReaderTests(unittest.TestCase):
    def test_real_zip_byte_headers_deflate_and_crc_without_extraction(self):
        data = bundle([
            ("Vehicles/", b""),
            ("Vehicles/Bus.bus", b"synthetic-bus"),
            ("sound/engine.wav", b"not-actual-wave")
        ], zipfile.ZIP_DEFLATED)
        report = examine_controlled_zip_bytes(data)
        self.assertEqual(report["fileCount"], 2)
        self.assertEqual(report["directoryCount"], 1)
        self.assertEqual(report["actualInflatedBytes"],
                         len(b"synthetic-bus") + len(b"not-actual-wave"))
        self.assertTrue(report["zipHeadersAndCrcRead"])
        for key in ("archiveOriginVerified", "gameRecognized",
                    "compatibilityVerified", "installationEnabled",
                    "realGameFilesTouched"):
            self.assertFalse(report[key])

    def test_deflated_directory_metadata_is_rejected(self):
        mem = io.BytesIO()
        with zipfile.ZipFile(mem, "w") as zf:
            item = zipfile.ZipInfo("vehicles/")
            item.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(item, b"")
        with self.assertRaises(ControlledZipRefused):
            examine_controlled_zip_bytes(mem.getvalue())

    def test_path_traversal_and_device_names_are_refused(self):
        for name in (
            "../private.bus", "/absolute.bus", "C:/mods/bus.bus",
            "a//b.bus", "a/./bus.bus", "a/../bus.bus", "a\\bad.bus",
            "CON.txt", "NUL", "a/LPT1.wav", "a/item.", "a/?name"
        ):
            with self.subTest(name=name):
                with self.assertRaises(ControlledZipRefused):
                    examine_controlled_zip_bytes(bundle([(name, b"x")]))

    def test_case_duplicates_and_file_as_parent_are_refused(self):
        for entries in (
            [("mod/a.bus", b"x"), ("MOD/A.BUS", b"x")],
            [("vehicles", b"x"), ("vehicles/a.bus", b"x")]
        ):
            with self.assertRaises(ControlledZipRefused):
                examine_controlled_zip_bytes(bundle(entries))

    def test_symlink_is_refused_even_without_extraction(self):
        mem = io.BytesIO()
        with zipfile.ZipFile(mem, "w") as zf:
            info = zipfile.ZipInfo("vehicles/link")
            info.create_system = 3
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            zf.writestr(info, b"../../private")
        with self.assertRaises(ControlledZipRefused):
            examine_controlled_zip_bytes(mem.getvalue())

    def test_expansion_ratio_entry_budget_and_input_size(self):
        data = bundle([("mod/compressible.scs", b"0" * 80_000)],
                      zipfile.ZIP_DEFLATED)
        with self.assertRaises(ControlledZipRefused):
            examine_controlled_zip_bytes(data)
        with self.assertRaises(ControlledZipRefused):
            examine_controlled_zip_bytes(b"x" * (MAX_ARCHIVE_BYTES+1))
        many = bundle([("mod/item"+str(i)+".bus", b"x") for i in range(129)])
        with self.assertRaises(ControlledZipRefused):
            examine_controlled_zip_bytes(many)

    def test_bad_crc_truncation_and_unrecognized_bytes(self):
        payload = bundle([("mod/data.scs", b"ORIGINAL")])
        bad = payload.replace(b"ORIGINAL", b"TAMPERED", 1)
        for data in (bad, payload[:23], b"NOT-A-ZIP", b""):
            with self.subTest(size=len(data)):
                with self.assertRaises(ControlledZipRefused):
                    examine_controlled_zip_bytes(data)

    def test_paths_and_mutable_bytearrays_cannot_trigger_disk_read(self):
        for data in ("/home/user/private-mod.scs", bytearray(b"x"), None, {}):
            with self.assertRaises(ControlledZipRefused):
                examine_controlled_zip_bytes(data)

    def test_encrypted_metadata_is_refused(self):
        raw = bytearray(bundle([("mod/a.bus", b"x")]))
        a = raw.find(b"PK\x03\x04")
        b = raw.find(b"PK\x01\x02")
        self.assertGreaterEqual(a, 0)
        self.assertGreaterEqual(b, 0)
        raw[a+6] |= 1
        raw[b+8] |= 1
        with self.assertRaises(ControlledZipRefused):
            examine_controlled_zip_bytes(bytes(raw))

if __name__ == "__main__":
    unittest.main()
