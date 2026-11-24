#!/usr/bin/env python3
"""Self-created Linux fixture only. No caller paths, production CLI or IPC."""
import contextlib
import json
import os
import stat
import sys
import tempfile
from pathlib import Path

MAX_BYTES = 65536
CHUNK = 4096
PARENT = "selected"
NAME = "fixture.bus"
ORIGINAL = b"[model]\nmodel\\fixture.cfg\n" + b"A" * 8192
SENTINEL = b"outside fixture sentinel"


class Refused(Exception):
    pass


def require(ok):
    if not ok:
        raise Refused()


def identity(s):
    return (s.st_dev, s.st_ino, s.st_mode, s.st_nlink, s.st_size,
            s.st_mtime_ns, s.st_ctime_ns)


def directory(s):
    require(stat.S_ISDIR(s.st_mode))
    return identity(s)


def regular(s):
    require(stat.S_ISREG(s.st_mode) and s.st_nlink == 1
            and 1 <= s.st_size <= MAX_BYTES)
    return identity(s)


@contextlib.contextmanager
def descriptor(name, flags, parent=None):
    fd = os.open(name, flags, dir_fd=parent)
    try:
        yield fd
    finally:
        os.close(fd)


def read_owned_fixture(root, checkpoint, cancelled, metrics):
    """Internal fixed-name fixture only; never expose this as a user path API."""
    directory_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
    file_flags = os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC

    def active():
        require(not cancelled())

    def at(parent, name):
        return os.stat(name, dir_fd=parent, follow_symlinks=False)

    try:
        active()
        with descriptor(root, directory_flags) as rootfd:
            with descriptor(PARENT, directory_flags, rootfd) as parentfd:
                expected_parent = directory(os.fstat(parentfd))
                expected_file = regular(at(parentfd, NAME))

                def verify_parent():
                    active()
                    require(directory(at(rootfd, PARENT)) == expected_parent)
                    require(directory(os.fstat(parentfd)) == expected_parent)
                    active()

                def verify_selected():
                    verify_parent()
                    require(regular(at(parentfd, NAME)) == expected_file)
                    active()

                checkpoint("before-open")
                verify_selected()
                with descriptor(NAME, file_flags, parentfd) as filefd:
                    metrics["opened"] += 1

                    def verify_handle():
                        verify_selected()
                        require(regular(os.fstat(filefd)) == expected_file)
                        active()

                    checkpoint("after-open")
                    verify_handle()
                    size = expected_file[4]
                    snapshots = []
                    for pass_number in range(2):
                        data = bytearray()
                        while len(data) < size:
                            verify_handle()
                            chunk = os.pread(filefd, min(CHUNK, size-len(data)), len(data))
                            metrics["readCalls"] += 1
                            metrics["bytesRead"] += len(chunk)
                            require(0 < len(chunk) <= CHUNK)
                            data.extend(chunk)
                            if pass_number == 0 and metrics["readCalls"] == 1:
                                checkpoint("after-first-read")
                            verify_handle()
                        snapshots.append(bytes(data))
                    verify_handle()
                    require(snapshots[0] == snapshots[1])
                    return snapshots[0]
    except (OSError, Refused):
        return None


def run_case(case):
    # All writes and namespace mutations are confined to this fresh directory.
    with tempfile.TemporaryDirectory(prefix="omsi-m111-dirfd-") as raw:
        root = Path(raw)
        parent = root / PARENT
        parent.mkdir(mode=0o700)
        outside = root / "outside"
        outside.mkdir(mode=0o700)
        (outside / NAME).write_bytes(SENTINEL)
        source = parent / NAME
        source.write_bytes(ORIGINAL)
        if case == "symlink":
            source.unlink()
            source.symlink_to(outside / NAME)
        elif case == "fifo":
            source.unlink()
            os.mkfifo(source, 0o600)
        elif case == "hardlink":
            os.link(source, parent / "alias.bus")
        elif case == "oversized":
            source.write_bytes(b"A" * (MAX_BYTES+1))
        elif case == "empty":
            source.write_bytes(b"")
        elif case == "maximum":
            source.write_bytes(b"A" * MAX_BYTES)
        cancelled = case == "cancel-before"
        changed = False

        def checkpoint(stage):
            nonlocal cancelled, changed
            if changed:
                return
            if case == "parent-replaced" and stage == "before-open":
                parent.rename(root / "retired")
                parent.mkdir(mode=0o700)
                (parent / NAME).write_bytes(SENTINEL)
            elif case == "file-replaced" and stage == "after-open":
                source.rename(parent / "retired.bus")
                source.write_bytes(SENTINEL)
            elif case == "changed-during-read" and stage == "after-first-read":
                source.write_bytes(b"B" * (len(ORIGINAL)+1))
            elif case == "cancel-during-read" and stage == "after-first-read":
                cancelled = True
            else:
                return
            changed = True

        metrics = {"opened": 0, "readCalls": 0, "bytesRead": 0}
        result = read_owned_fixture(root, checkpoint, lambda: cancelled, metrics)
        if case in ("normal", "maximum"):
            expected = ORIGINAL if case == "normal" else b"A" * MAX_BYTES
            require(result == expected and source.read_bytes() == expected)
            require(metrics["opened"] == 1 and metrics["bytesRead"] == 2*len(expected))
            outcome = "matching-two-snapshots"
        else:
            require(result is None)
            if case in ("changed-during-read", "cancel-during-read"):
                require(changed and metrics["readCalls"] == 1
                        and metrics["bytesRead"] <= CHUNK)
            else:
                require(metrics["readCalls"] == 0 and metrics["bytesRead"] == 0)
            if case == "file-replaced":
                require(changed and metrics["opened"] == 1)
                require(source.read_bytes() == SENTINEL)
            elif case == "parent-replaced":
                require(changed and metrics["opened"] == 0)
                require((root / "retired" / NAME).read_bytes() == ORIGINAL)
            else:
                if case not in ("changed-during-read", "cancel-during-read"):
                    require(metrics["opened"] == 0)
            outcome = "refused"
        require((outside / NAME).read_bytes() == SENTINEL)
        return {"scenario": case, "outcome": outcome, **metrics}



def format_fixture():
    # Fixed publicly authored bytes only; never export a caller-selected file.
    # The transport is a test-only wire fixture, not an application protocol.
    import base64
    rows = []
    samples = (
        ("vehicle-definition", b"[model]\r\nmodel\\vehicle.cfg\r\n[sound]\r\nsound.cfg\r\n"),
        ("vehicle-model", b"[mesh]\r\nbody.o3d\r\n[mesh]\r\nmissing.o3d\r\n"),
    )
    for role, expected in samples:
        with tempfile.TemporaryDirectory(prefix="omsi-m115-format-") as raw:
            root = Path(raw)
            parent = root / PARENT
            parent.mkdir(mode=0o700)
            source = parent / NAME
            source.write_bytes(expected)
            metrics = {"opened": 0, "readCalls": 0, "bytesRead": 0}
            result = read_owned_fixture(root, lambda _: None, lambda: False, metrics)
            require(result == expected and source.read_bytes() == expected)
            require(metrics["opened"] == 1 and metrics["bytesRead"] == 2*len(expected))
            rows.append({"role": role, "fixtureBase64": base64.b64encode(result).decode("ascii"),
                         **metrics})
    print(json.dumps({"schema": "omsi-m115-fixed-native-format-fixture-v1",
                      "platform": "linux", "cases": rows, "realModRead": False,
                      "operationsEnabled": False}, separators=(",", ":")))

def main():
    require(sys.platform == "linux" and (len(sys.argv) == 1 or sys.argv[1:] == ["--test-format-m115"]))
    require(all(hasattr(os, name) for name in
                ("O_DIRECTORY", "O_NOFOLLOW", "O_NONBLOCK", "O_CLOEXEC", "pread")))
    require(os.open in os.supports_dir_fd and os.stat in os.supports_dir_fd
            and os.stat in os.supports_follow_symlinks)
    if sys.argv[1:] == ["--test-format-m115"]:
        format_fixture()
        return
    scenarios = ("normal", "maximum", "symlink", "fifo", "hardlink", "oversized",
                 "empty", "parent-replaced", "file-replaced", "changed-during-read",
                 "cancel-before", "cancel-during-read")
    rows = [run_case(case) for case in scenarios]
    print(json.dumps({"schema": "omsi-m111-linux-dirfd-fixture-v1",
                      "cases": rows, "nativeDirFdUsed": True,
                      "nativeIdentityVerifiedForRealMods": False,
                      "atomicContainmentProven": False,
                      "abaRuledOut": False, "osDeadlineProven": False,
                      "realModRead": False, "operationsEnabled": False},
                     separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("M111_LINUX_FIXTURE_REFUSED", file=sys.stderr)
        sys.exit(3)
