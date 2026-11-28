"""F4.01c: Linux-only disposable openat2 laboratory. No caller paths or real mods."""
import ctypes
import errno
import hashlib
import json
import os
import platform
import stat
import sys
import tempfile
from pathlib import Path

class Refused(Exception):
    pass

class OpenHow(ctypes.Structure):
    _fields_ = [("flags", ctypes.c_uint64), ("mode", ctypes.c_uint64), ("resolve", ctypes.c_uint64)]

def run():
    if sys.platform != "linux" or platform.machine() not in ("x86_64", "aarch64") or len(sys.argv) != 1:
        raise Refused()
    libc = ctypes.CDLL(None, use_errno=True)
    libc.syscall.restype = ctypes.c_long
    # Linux x86_64/aarch64 syscall ABI only; no fallback to path-based open.
    def open_relative(root, name):
        if not isinstance(name, bytes) or not name or any(p in (b"", b".", b"..") for p in name.split(b"/")) or b"\0" in name:
            raise Refused()
        how = OpenHow(os.O_RDONLY | os.O_CLOEXEC | os.O_NONBLOCK | os.O_NOFOLLOW, 0, 0x01 | 0x02 | 0x04 | 0x08)
        fd = libc.syscall(ctypes.c_long(437), ctypes.c_int(root), ctypes.c_char_p(name), ctypes.byref(how), ctypes.c_size_t(ctypes.sizeof(how)))
        if fd < 0:
            raise Refused() from None
        return fd

    def identity(s):
        return (s.st_dev, s.st_ino, s.st_mode, s.st_nlink, s.st_size, s.st_mtime_ns, s.st_ctime_ns)

    def read(root, name, limit, barrier=None):
        fd = open_relative(root, name)
        try:
            before = os.fstat(fd)
            if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or before.st_dev != os.fstat(root).st_dev or not 0 <= before.st_size <= limit:
                raise Refused()
            if barrier is not None:
                barrier()
            data = bytearray()
            while len(data) < before.st_size:
                part = os.read(fd, min(4096, before.st_size - len(data)))
                if not part:
                    raise Refused()
                data.extend(part)
            if identity(before) != identity(os.fstat(fd)):
                raise Refused()
            # Reopening the same relative name is only an additional observation,
            # never proof that ABA or concurrent in-place mutation is impossible.
            check = open_relative(root, name)
            try:
                if identity(before) != identity(os.fstat(check)):
                    raise Refused()
            finally:
                os.close(check)
            return hashlib.sha256(data).hexdigest()
        finally:
            os.close(fd)

    passed = []
    def denied(name, fn):
        try:
            fn()
        except Refused:
            passed.append(name)
            return
        raise AssertionError("expected-refusal")

    def changed(case, root_fd, name, mutation):
        completed = False
        def barrier():
            nonlocal completed
            mutation()
            completed = True
        denied(case, lambda: read(root_fd, name, 64, barrier))
        if not completed:
            raise AssertionError("mutation-not-executed")

    with tempfile.TemporaryDirectory(prefix="negresco-openat2-fixture-") as tmp:
        base = Path(tmp)
        root = base / "root"
        outside = base / "sibling"
        root.mkdir(mode=0o700)
        outside.mkdir(mode=0o700)
        (root / "nested").mkdir(mode=0o700)
        (root / "nested" / "valid.bin").write_bytes(b"synthetic")
        (outside / "sentinel.bin").write_bytes(b"outside-fixture")
        (root / "link.bin").symlink_to(outside / "sentinel.bin")
        (root / "redirect").symlink_to(outside, target_is_directory=True)
        os.link(root / "nested" / "valid.bin", root / "hard.bin")
        (root / "hard.bin").unlink()
        (root / "hard-source.bin").write_bytes(b"hard")
        os.link(root / "hard-source.bin", root / "hard.bin")
        os.mkfifo(root / "fifo", 0o600)
        (root / "large.bin").write_bytes(b"x" * 33)
        (root / "mutate.bin").write_bytes(b"before")
        (root / "replace.bin").write_bytes(b"before")
        (root / "replacement.bin").write_bytes(b"after!")
        (root / "parent").mkdir()
        (root / "parent" / "data.bin").write_bytes(b"parent")
        root_fd = os.open(root, os.O_PATH | os.O_DIRECTORY | os.O_CLOEXEC | os.O_NOFOLLOW)
        try:
            assert read(root_fd, b"nested/valid.bin", 9) == hashlib.sha256(b"synthetic").hexdigest()
            passed.append("nested-regular-same-handle")
            denied("leaf-symlink", lambda: read(root_fd, b"link.bin", 64))
            denied("parent-symlink", lambda: read(root_fd, b"redirect/sentinel.bin", 64))
            denied("traversal", lambda: read(root_fd, b"../sibling/sentinel.bin", 64))
            denied("absolute", lambda: read(root_fd, b"/sentinel.bin", 64))
            denied("hardlink", lambda: read(root_fd, b"hard.bin", 64))
            denied("fifo", lambda: read(root_fd, b"fifo", 64))
            denied("directory", lambda: read(root_fd, b"nested", 64))
            denied("size-cap", lambda: read(root_fd, b"large.bin", 32))
            changed("in-place-mutation", root_fd, b"mutate.bin", lambda: (root / "mutate.bin").write_bytes(b"changed-size"))
            changed("file-replacement", root_fd, b"replace.bin", lambda: os.replace(root / "replacement.bin", root / "replace.bin"))
            def parent_swap():
                (root / "parent").rename(root / "retired-parent")
                (root / "parent").symlink_to(outside, target_is_directory=True)
            changed("parent-substitution", root_fd, b"parent/data.bin", parent_swap)
            assert (outside / "sentinel.bin").read_bytes() == b"outside-fixture"
            passed.append("sibling-unchanged")
        finally:
            os.close(root_fd)
    return {"scope": "disposable-linux-fixture", "cases": passed, "nativeOpenat2Observed": True,
            "atomicContainmentProven": False, "abaRuledOut": False, "realReadsPerformed": False,
            "operationsEnabled": False, "releaseAuthorized": False}

if __name__ == "__main__":
    try:
        print(json.dumps(run(), separators=(",", ":")))
    except Exception:
        print("NEGRESCO_NATIVE_FIXTURE_REFUSED", file=sys.stderr)
        sys.exit(3)
