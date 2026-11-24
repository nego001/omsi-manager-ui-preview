#!/usr/bin/env python3
"""Fixed self-created dependency metadata fixture. No dependency content opens."""
import contextlib
import json
import os
import stat
import sys
import tempfile
from pathlib import Path

class Refused(Exception):
    pass

def require(ok):
    if not ok:
        raise Refused()

@contextlib.contextmanager
def directory(name, parent=None):
    fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC,
                 dir_fd=parent)
    try:
        yield fd
    finally:
        os.close(fd)

def snapshot(fd):
    s = os.fstat(fd)
    require(stat.S_ISDIR(s.st_mode))
    return (s.st_dev, s.st_ino, s.st_mode, s.st_mtime_ns, s.st_ctime_ns)

def lookup(fd, requested, budget):
    # Fixed ASCII component only, no separators, traversal or caller input.
    require(requested in ("body.o3d", "Body.o3d", "missing.o3d",
                          "ambiguous.o3d", "linked.o3d", "folder.o3d"))
    before = snapshot(fd)
    names = []
    with os.scandir(fd) as entries:
        for entry in entries:
            if budget[0] == 0:
                return "budget-limited"
            budget[0] -= 1
            if entry.name.lower() == requested.lower():
                names.append(entry.name)
    require(snapshot(fd) == before)
    if len(names) > 1:
        return "ambiguous-case"
    if not names:
        return "not-observed-in-directory"
    name = names[0]
    s = os.stat(name, dir_fd=fd, follow_symlinks=False)
    require(snapshot(fd) == before)
    if stat.S_ISLNK(s.st_mode):
        return "link-refused"
    if not stat.S_ISREG(s.st_mode) or s.st_nlink != 1:
        return "not-regular-path"
    return "exact-observed" if name == requested else "case-only-observed"

def main():
    require(sys.platform == "linux" and len(sys.argv) == 1)
    require(os.scandir in os.supports_fd and os.stat in os.supports_dir_fd)
    with tempfile.TemporaryDirectory(prefix="omsi-m116-deps-") as tmp:
        root = Path(tmp)
        model = root / "model"
        model.mkdir(mode=0o700)
        sentinel = root / "outside.o3d"
        sentinel.write_bytes(b"fixture sentinel")
        for name in ("body.o3d", "Ambiguous.o3d", "AMBIGUOUS.o3d"):
            (model / name).write_bytes(b"fixture")
        (model / "folder.o3d").mkdir()
        (model / "linked.o3d").symlink_to(sentinel)
        cases = (("exact", "body.o3d", 64, "exact-observed"),
                 ("case-only", "Body.o3d", 64, "case-only-observed"),
                 ("missing", "missing.o3d", 64, "not-observed-in-directory"),
                 ("ambiguous", "ambiguous.o3d", 64, "ambiguous-case"),
                 ("link", "linked.o3d", 64, "link-refused"),
                 ("directory", "folder.o3d", 64, "not-regular-path"),
                 ("limited", "missing.o3d", 1, "budget-limited"))
        rows = []
        with directory(root) as rootfd:
            with directory("model", rootfd) as modelfd:
                for scenario, name, limit, expected in cases:
                    budget = [limit]
                    outcome = lookup(modelfd, name, budget)
                    require(outcome == expected)
                    rows.append({"scenario": scenario, "outcome": outcome,
                                 "entriesScanned": limit-budget[0]})
        require(sentinel.read_bytes() == b"fixture sentinel")
        print(json.dumps({"schema": "omsi-m116-linux-dependency-metadata-fixture-v1",
                          "cases": rows, "nativeDirectoryDescriptorUsed": True,
                          "dependencyContentsRead": False, "realModValidated": False,
                          "atomicContainmentProven": False, "operationsEnabled": False},
                         separators=(",", ":")))

if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("M116_DEPENDENCY_FIXTURE_REFUSED", file=sys.stderr)
        sys.exit(3)
