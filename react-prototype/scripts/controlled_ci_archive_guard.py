"""CI-only header guard for a verified, unsigned Linux portable TAR archive.

Pre-extraction sanity checks, NOT authentication of the SHA256 manifest,
an operating-system sandbox, or a general-purpose archive extractor.
Only fixed artifact basename in the current CI directory is supported.
"""
from __future__ import annotations

import os
import stat
import sys
import tarfile
from pathlib import Path

ARCHIVE_NAME = "OMSI-Manager-Preview-Linux-x64.tar.gz"
ROOT = "OMSI-Manager-Preview-linux-x64"
REQUIRED = {ROOT + "/OMSI-Manager-Preview", ROOT + "/OMSI-Manager-Auto"}
MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024
MAX_MEMBERS = 30000
MAX_UNPACKED_BYTES = 4 * 1024 * 1024 * 1024
MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024


class CiArchiveRefused(ValueError):
    pass


def refuse():
    raise CiArchiveRefused("CI_LINUX_ARCHIVE_HEADERS_REFUSED")


def validate_tar_members(archive):
    """Inspect headers only. Never extract, follow links, or return names."""
    seen = set()
    total = 0
    members = 0
    for entry in archive:
        members += 1
        if members > MAX_MEMBERS:
            refuse()
        name = entry.name
        if not isinstance(name, str) or len(name) > 1024 or not name:
            refuse()
        if any(ord(ch) < 32 or ord(ch) == 127 for ch in name):
            refuse()
        if "\\" in name or name.startswith("/"):
            refuse()
        canonical = name.rstrip("/") if entry.isdir() else name
        parts = canonical.split("/")
        if (not parts or parts[0] != ROOT or
                any(p in ("", ".", "..") for p in parts)):
            refuse()
        if canonical in seen:
            refuse()
        seen.add(canonical)
        # All symlinks/hard links, devices, pipes, GNU sparse and other
        # special entries are rejected instead of trying to resolve targets.
        if entry.type not in (tarfile.REGTYPE, tarfile.AREGTYPE, tarfile.DIRTYPE):
            refuse()
        if entry.mode & (stat.S_ISUID | stat.S_ISGID):
            refuse()
        if any(k.startswith("GNU.sparse") or "xattr" in k.lower()
               for k in entry.pax_headers):
            refuse()
        if entry.isdir():
            if entry.size != 0:
                refuse()
            continue
        if entry.size < 0 or entry.size > MAX_FILE_BYTES:
            refuse()
        total += entry.size
        if total > MAX_UNPACKED_BYTES:
            refuse()
    if members < 3 or not REQUIRED.issubset(seen):
        refuse()
    return {"verified": True, "scope": "ci-unsigned-archive-headers-only"}


def validate_fixture_stream(stream):
    """For synthetic in-memory unit tests only; never read mod paths."""
    try:
        with tarfile.open(fileobj=stream, mode="r:gz") as archive:
            return validate_tar_members(archive)
    except (tarfile.TarError, EOFError, OSError, OverflowError, MemoryError):
        refuse()


def main(argv):
    if argv:
        refuse()
    # Refuse symlink substitution of the fixed downloaded CI artifact.
    path = Path.cwd() / ARCHIVE_NAME
    st = path.lstat()
    if not stat.S_ISREG(st.st_mode) or st.st_nlink != 1:
        refuse()
    if st.st_size <= 0 or st.st_size > MAX_ARCHIVE_BYTES:
        refuse()
    with path.open("rb") as stream:
        validate_fixture_stream(stream)
    print("PASS_CI_LINUX_ARCHIVE_HEADERS_VERIFIED")


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except Exception:
        # Raw archive headers, names, paths and exception text are private.
        print("CI_LINUX_ARCHIVE_HEADERS_REFUSED", file=sys.stderr)
        sys.exit(2)
