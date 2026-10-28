"""CI Linux: refuse workers with unexpected inherited file descriptors.

The already-open, CI-created ZIP fixture FDs must be the *only* descriptors
numbered >= 3. /proc/self/fd enumeration occurs before the seccomp guard, in
a worker with no external user ZIP access. This is not proof of origin,
absence of races, or full OS sandboxing.
"""
from __future__ import annotations

import errno
import fcntl
import os
import stat
import sys


class CiFdInventoryRefused(ValueError):
    def __init__(self, phase: str):
        super().__init__("CI_FD_INVENTORY_REFUSED")
        self.phase = phase  # fixed codes only; never FD numbers or paths


def refuse(phase="GENERAL"):
    raise CiFdInventoryRefused(phase)


def verify_exact_inherited_ci_fixture_fds(expected: tuple[int, ...], worker_source: str) -> None:
    """Fail closed if an unexpected live FD is inherited from the parent.

    The transient descriptor for reading /proc/self/fd can appear in its own
    listing; it is closed before fstat and therefore ignored only on EBADF.
    No descriptor names, symlink targets or host paths are returned or logged.
    """
    if (sys.platform != "linux" or type(worker_source) is not str
            or os.path.basename(worker_source) not in (
                "controlled_ci_file_reader.py",
                "controlled_ci_group_fd_reader.py")
            or type(expected) is not tuple
            or not 1 <= len(expected) <= 4
            or any(type(fd) is not int or fd < 3 or fd >= 64 for fd in expected)
            or len(set(expected)) != len(expected)):
        refuse("ARGUMENTS")
    try:
        script_info = os.stat(worker_source, follow_symlinks=False)
        if not stat.S_ISREG(script_info.st_mode):
            refuse("SOURCE_TYPE")
        script_identity = (script_info.st_dev, script_info.st_ino)
        script_fds = 0
        present = set()
        for name in os.listdir("/proc/self/fd"):
            if not name.isascii() or not name.isdecimal():
                refuse("PROC_ENTRY")
            fd = int(name, 10)
            if fd <= 2:
                continue
            try:
                status = os.fstat(fd)
            except OSError as error:
                if error.errno == errno.EBADF:
                    # The procfs listing's own descriptor is already closed.
                    continue
                refuse("PROC_STAT")
            if fd not in expected:
                # Some Python builds retain the currently executing script
                # as a read-only FD. Match its inode exactly, never its name,
                # and allow at most one such interpreter-owned FD.
                flags = fcntl.fcntl(fd, fcntl.F_GETFL)
                identity = (status.st_dev, status.st_ino)
                if (identity == script_identity and script_fds == 0
                        and stat.S_ISREG(status.st_mode)
                        and (flags & os.O_ACCMODE) == os.O_RDONLY):
                    script_fds = 1
                    continue
                if stat.S_ISDIR(status.st_mode):
                    refuse("EXTRA_DIRECTORY")
                if stat.S_ISREG(status.st_mode):
                    refuse("EXTRA_REGULAR")
                if stat.S_ISSOCK(status.st_mode):
                    refuse("EXTRA_SOCKET")
                if stat.S_ISFIFO(status.st_mode):
                    refuse("EXTRA_PIPE")
                refuse("EXTRA_OTHER")
            present.add(fd)
            flags = fcntl.fcntl(fd, fcntl.F_GETFL)
            if (not stat.S_ISREG(status.st_mode) or status.st_nlink != 1
                    or (flags & os.O_ACCMODE) != os.O_RDONLY):
                refuse("FD_TYPE")
        if present != set(expected):
            refuse("MISSING")
    except CiFdInventoryRefused:
        raise
    except (OSError, OverflowError, MemoryError, ValueError):
        refuse("PROC_FAILURE")
