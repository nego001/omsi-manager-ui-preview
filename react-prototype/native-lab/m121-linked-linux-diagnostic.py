#!/usr/bin/env python3
"""Linux fixed fixture: same pinned directory and config handle across analysis.
No caller paths, no game files, no dependency content reads, no production API.
"""
import contextlib
import json
import os
import stat
import sys
import tempfile
from pathlib import Path

MAX_BYTES = 65536
MAX_ENTRIES = 64
CONFIG = "vehicle.cfg"
FIXED = b"[mesh]\r\nbody.o3d\r\n[mesh]\r\nmissing.o3d\r\n"
NAMES = ("body.o3d", "missing.o3d")

class Refused(Exception):
    pass

def require(ok):
    if not ok:
        raise Refused()

def identity(info):
    return (info.st_dev, info.st_ino, info.st_mode, info.st_nlink,
            info.st_size, info.st_mtime_ns, info.st_ctime_ns)

@contextlib.contextmanager
def opened(name, flags, parent=None):
    fd = os.open(name, flags, dir_fd=parent)
    try:
        yield fd
    finally:
        os.close(fd)

def at(fd, name):
    return os.stat(name, dir_fd=fd, follow_symlinks=False)

def observe(root, checkpoint, cancelled, metrics):
    dflags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
    fflags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC
    def active():
        require(not cancelled())
    try:
        active()
        with opened(root, dflags) as rfd:
            with opened("model", dflags, rfd) as dfd:
                directory = identity(os.fstat(dfd))
                before = at(dfd, CONFIG)
                require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1
                        and 1 <= before.st_size <= MAX_BYTES)
                source = identity(before)
                with opened(CONFIG, fflags, dfd) as cfd:
                    def verify():
                        active()
                        require(identity(os.fstat(dfd)) == directory and
                                identity(at(rfd, "model")) == directory and
                                identity(at(dfd, CONFIG)) == source and
                                identity(os.fstat(cfd)) == source)
                        active()
                    def read_snapshot():
                        data = bytearray()
                        while len(data) < before.st_size:
                            verify()
                            chunk = os.pread(cfd, min(4096, before.st_size-len(data)), len(data))
                            metrics["configReadCalls"] += 1
                            metrics["configBytesRead"] += len(chunk)
                            require(chunk and len(chunk) <= 4096)
                            data.extend(chunk)
                            verify()
                        return bytes(data)
                    first, second = read_snapshot(), read_snapshot()
                    require(first == second == FIXED)
                    # Deliberately only the exact pre-authored grammar; never
                    # promote fixture references into arbitrary path opens.
                    lines = first.decode("ascii").splitlines()
                    require(lines == ["[mesh]", NAMES[0], "[mesh]", NAMES[1]])
                    checkpoint("between-content-and-metadata")
                    verify()
                    outcomes = []
                    for name in (lines[1], lines[3]):
                        verify()
                        matches = []
                        with os.scandir(dfd) as entries:
                            for entry in entries:
                                require(metrics["entriesScanned"] < MAX_ENTRIES)
                                metrics["entriesScanned"] += 1
                                if entry.name.lower() == name.lower():
                                    matches.append(entry.name)
                        verify()
                        if not matches:
                            outcomes.append("not-observed-in-directory")
                        elif len(matches) > 1:
                            outcomes.append("ambiguous-case")
                        else:
                            item = at(dfd, matches[0])
                            if stat.S_ISLNK(item.st_mode):
                                outcomes.append("link-refused")
                            elif not stat.S_ISREG(item.st_mode) or item.st_nlink != 1:
                                outcomes.append("not-regular-path")
                            else:
                                outcomes.append("exact-observed" if matches[0] == name else "case-only-observed")
                        metrics["referencesObserved"] += 1
                        checkpoint("after-first-dependency" if len(outcomes) == 1 else "after-second-dependency")
                        verify()
                    # Re-read original config through the SAME retained handle.
                    require(read_snapshot() == first)
                    verify()
                    return outcomes
    except (Refused, OSError):
        return None

def run_case(scenario):
    with tempfile.TemporaryDirectory(prefix="omsi-m121-linked-") as tmp:
        root = Path(tmp)
        model = root / "model"
        model.mkdir(mode=0o700)
        cfg = model / CONFIG
        cfg.write_bytes(FIXED)
        sentinel = root / "outside.o3d"
        sentinel.write_bytes(b"outside fixture sentinel")
        target = model / "body.o3d"
        target.write_bytes(b"dependency fixture")
        if scenario == "case-only":
            target.rename(model / "Body.o3d")
        elif scenario == "link":
            target.unlink()
            target.symlink_to(sentinel)
        cancelled = False
        changed = False
        def checkpoint(stage):
            nonlocal cancelled, changed
            if changed:
                return
            if stage == "between-content-and-metadata":
                if scenario == "parent-replaced":
                    model.rename(root / "retired")
                    model.mkdir(mode=0o700)
                    (model / CONFIG).write_bytes(FIXED)
                elif scenario == "config-replaced":
                    cfg.rename(model / "retired.cfg")
                    cfg.write_bytes(FIXED)
                elif scenario == "cancel-between":
                    cancelled = True
                else:
                    return
            elif stage == "after-first-dependency" and scenario == "directory-changed":
                (model / "new.o3d").write_bytes(b"changed")
            elif stage == "after-first-dependency" and scenario == "cancel-during-metadata":
                cancelled = True
            else:
                return
            changed = True
        metrics = {"configReadCalls": 0, "configBytesRead": 0,
                   "entriesScanned": 0, "referencesObserved": 0}
        result = observe(root, checkpoint, lambda: cancelled, metrics)
        expected = {"normal": "exact-observed", "case-only": "case-only-observed",
                    "link": "link-refused"}
        if scenario in expected:
            require(result == [expected[scenario], "not-observed-in-directory"])
            require(metrics["configBytesRead"] == 3*len(FIXED) and
                    metrics["referencesObserved"] == 2)
            status = "linked-fixture-observed"
        else:
            require(result is None and changed and metrics["configBytesRead"] == 2*len(FIXED))
            if scenario in ("parent-replaced", "config-replaced", "cancel-between"):
                require(metrics["referencesObserved"] == 0 and metrics["entriesScanned"] == 0)
            else:
                require(metrics["referencesObserved"] == 1)
            status = "linked-fixture-refused"
        require(sentinel.read_bytes() == b"outside fixture sentinel")
        require(cfg.read_bytes() == FIXED)
        return {"scenario": scenario, "status": status, "outcomes": result or [], **metrics}

def main():
    require(sys.platform == "linux" and len(sys.argv) == 1)
    require(os.open in os.supports_dir_fd and os.stat in os.supports_dir_fd and os.scandir in os.supports_fd)
    cases = [run_case(s) for s in ("normal", "case-only", "link", "parent-replaced",
             "config-replaced", "cancel-between", "directory-changed", "cancel-during-metadata")]
    print(json.dumps({"schema": "omsi-m121-linked-linux-diagnostic-fixture-v1",
                      "scope": "fixed-synthetic-tree-only", "cases": cases,
                      "sameRetainedHandlesUsed": True, "dependencyContentsRead": False,
                      "realModValidated": False, "atomicContainmentProven": False,
                      "nativeConsentVerified": False, "operationsEnabled": False}, separators=(",", ":")))

if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("M121_LINKED_FIXTURE_REFUSED", file=sys.stderr)
        sys.exit(3)
