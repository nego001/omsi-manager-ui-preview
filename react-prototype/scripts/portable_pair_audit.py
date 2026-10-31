#!/usr/bin/env python3
"""Read-only cross-platform audit of two unsigned CI portable archives.

This never extracts or executes archive members. A source SHA in a JSON manifest
is advisory provenance, not a digital signature or reproducible-build proof.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import tarfile
import zipfile

MAX_ARCHIVE_BYTES = 1_073_741_824
MAX_UNCOMPRESSED_BYTES = 3_221_225_472
MAX_MEMBERS = 50_000
MAX_MANIFEST_BYTES = 2048
SHA40 = re.compile(r"[0-9a-f]{40}\Z")
SHA256 = re.compile(r"[0-9a-f]{64}\Z")
LINUX_ROOT = "OMSI-Manager-Preview-linux-x64"
WINDOWS_ROOT = "OMSI-Manager-Preview-win32-x64"
MANIFEST = "OMSI-Manager-Preview-build.json"


class AuditRefused(ValueError):
    pass


def refuse(message: str) -> None:
    raise AuditRefused(message)


def read_regular(path: Path, limit: int | None = None) -> bytes:
    if path.is_symlink() or not path.is_file():
        refuse("Input must be a regular non-symlink file")
    if limit is not None and path.stat().st_size > limit:
        refuse("Input exceeds size limit")
    return path.read_bytes()


def check_sha256(archive: Path, sidecar: Path) -> None:
    if archive.is_symlink() or not archive.is_file():
        refuse("Archive must be a regular non-symlink file")
    if archive.stat().st_size <= 0 or archive.stat().st_size > MAX_ARCHIVE_BYTES:
        refuse("Archive is empty or exceeds size limit")
    try:
        content = read_regular(sidecar, 256).decode("ascii")
    except (UnicodeError, OSError) as exc:
        raise AuditRefused("Invalid SHA256 sidecar") from exc
    matched = re.fullmatch(
        r"([0-9a-f]{64})[ \t]+\*?" + re.escape(archive.name) + r"\r?\n?",
        content,
    )
    if not matched:
        refuse("Malformed SHA256 sidecar")
    digest = hashlib.sha256()
    with archive.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != matched.group(1):
        refuse("SHA256 checksum mismatch")


def checked_member(name: str, root: str) -> str:
    if not isinstance(name, str) or "\x00" in name or "\\" in name:
        refuse("Archive member name is unsafe")
    if name.startswith("/") or "//" in name or ":" in name:
        refuse("Absolute, empty or drive-qualified archive path")
    parts = name.rstrip("/").split("/")
    if any(part in ("", ".", "..") for part in parts) or parts[0] != root:
        refuse("Archive member escapes expected portable root")
    return "/".join(parts)


def check_manifest(raw: bytes, platform: str, revision: str) -> dict:
    if not 0 < len(raw) <= MAX_MANIFEST_BYTES:
        refuse("Manifest exceeds size limit")
    try:
        doc = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise AuditRefused("Invalid JSON manifest") from exc
    expected = {
        "schemaVersion": 1,
        "product": "OMSI Manager Preview",
        "operatingSystem": platform,
        "architecture": "x64",
        "sourceRevision": revision,
        "buildEnvironment": "github-actions",
        "mode": "read-only",
        "modificationEnabled": False,
        "signatureStatus": "unsigned",
    }
    if not isinstance(doc, dict) or set(doc) != set(expected):
        refuse("Manifest keys do not match strict schema")
    if any(type(doc[key]) is not type(value) or doc[key] != value
           for key, value in expected.items()):
        refuse("Manifest does not match platform, commit or read-only contract")
    return doc


def validate_listing(names: set[str], root: str, platform: str) -> None:
    required = {
        root + "/" + MANIFEST,
        root + "/resources/app.asar",
        root + ("/OMSI-Manager-Preview.exe" if platform == "windows"
                else "/OMSI-Manager-Preview"),
    }
    if platform == "linux":
        required.add(root + "/OMSI-Manager-Auto")
    if not required <= names:
        refuse("Missing executable, native launcher, app.asar or manifest")
    forbidden = (
        ["OMSI-Manager-Auto", "OMSI-Manager-Preview"]
        if platform == "windows"
        else ["OMSI-Manager-Preview.exe"]
    )
    # The Linux ELF executable is legitimately named OMSI-Manager-Preview;
    # the Windows-specific file name is the actual incompatible one.
    if platform == "windows":
        forbidden = ["OMSI-Manager-Auto"]
    if any(root + "/" + item in names for item in forbidden):
        refuse("Foreign platform binary mixed into portable archive")
    if any("/native-launcher/" in name or "/native-lab/" in name or
           "/test-results/" in name for name in names):
        refuse("Development source or laboratory file in portable archive")


def scan_windows(archive: Path, revision: str) -> dict:
    names: set[str] = set()
    total = 0
    manifest: bytes | None = None
    with zipfile.ZipFile(archive) as zf:
        if len(zf.infolist()) > MAX_MEMBERS:
            refuse("Too many archive entries")
        for entry in zf.infolist():
            name = checked_member(entry.filename, WINDOWS_ROOT)
            if name in names:
                refuse("Duplicate ZIP member")
            names.add(name)
            if entry.flag_bits & 1:
                refuse("Encrypted ZIP members are not allowed")
            mode = entry.external_attr >> 16
            if stat.S_IFMT(mode) == stat.S_IFLNK:
                refuse("ZIP symlinks are not allowed")
            total += entry.file_size
            if entry.file_size > MAX_ARCHIVE_BYTES or total > MAX_UNCOMPRESSED_BYTES:
                refuse("ZIP has excessive uncompressed size")
            if name == WINDOWS_ROOT + "/" + MANIFEST:
                if entry.file_size > MAX_MANIFEST_BYTES:
                    refuse("ZIP manifest too large")
                manifest = zf.read(entry)
    validate_listing(names, WINDOWS_ROOT, "windows")
    if manifest is None:
        refuse("Windows manifest missing")
    return check_manifest(manifest, "windows", revision)


def scan_linux(archive: Path, revision: str) -> dict:
    names: set[str] = set()
    total = 0
    manifest: bytes | None = None
    with tarfile.open(archive, mode="r:gz") as tf:
        for count, entry in enumerate(tf, start=1):
            if count > MAX_MEMBERS:
                refuse("Too many archive entries")
            name = checked_member(entry.name, LINUX_ROOT)
            if name in names:
                refuse("Duplicate TAR member")
            names.add(name)
            if not (entry.isfile() or entry.isdir()):
                refuse("Links and device entries are not allowed")
            if entry.size > MAX_ARCHIVE_BYTES:
                refuse("TAR entry exceeds size limit")
            total += entry.size
            if total > MAX_UNCOMPRESSED_BYTES:
                refuse("TAR uncompressed size exceeds limit")
            if name == LINUX_ROOT + "/" + MANIFEST:
                if not entry.isfile() or entry.size > MAX_MANIFEST_BYTES:
                    refuse("TAR manifest must be small and regular")
                stream = tf.extractfile(entry)
                if stream is None:
                    refuse("Cannot read TAR manifest")
                manifest = stream.read(MAX_MANIFEST_BYTES + 1)
    validate_listing(names, LINUX_ROOT, "linux")
    if manifest is None:
        refuse("Linux manifest missing")
    return check_manifest(manifest, "linux", revision)


def verify_pair(linux_dir: Path, windows_dir: Path, revision: str) -> None:
    if not SHA40.fullmatch(revision):
        refuse("Expected Git revision must be a lowercase 40-character SHA")
    linux_archive = linux_dir / "OMSI-Manager-Preview-Linux-x64.tar.gz"
    windows_archive = windows_dir / "OMSI-Manager-Preview-Windows-x64.zip"
    check_sha256(linux_archive,
                 linux_dir / "OMSI-Manager-Preview-Linux-x64.sha256")
    check_sha256(windows_archive,
                 windows_dir / "OMSI-Manager-Preview-Windows-x64.sha256")
    linux = scan_linux(linux_archive, revision)
    windows = scan_windows(windows_archive, revision)
    if linux["sourceRevision"] != windows["sourceRevision"]:
        refuse("Windows and Linux archives identify different commits")


def main() -> int:
    if (len(sys.argv) != 3 or
        os.environ.get("GITHUB_ACTIONS") != "true" or
        os.environ.get("OMSI_PAIR_AUDIT_SCOPE") != "CI_UNSIGNED_PAIRS_ONLY"):
        print("PAIR_AUDIT_REFUSED: CI-only audit scope", file=sys.stderr)
        return 3
    try:
        verify_pair(Path(sys.argv[1]), Path(sys.argv[2]),
                    os.environ.get("GITHUB_SHA", ""))
    except (AuditRefused, OSError, tarfile.TarError, zipfile.BadZipFile) as exc:
        # Do not log archive members, user paths or unexpected payloads.
        print("PAIR_AUDIT_FAILED: archive integrity or provenance refused",
              file=sys.stderr)
        return 1
    print("PASS_WINDOWS_LINUX_ARCHIVE_COMMIT_PARITY_UNSIGNED_READ_ONLY")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
