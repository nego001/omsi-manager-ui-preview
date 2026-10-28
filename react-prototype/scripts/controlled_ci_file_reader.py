"""CI ONLY: read an already-open regular fixture ZIP FD, without writing.

This is deliberately not a production sandbox. No path arguments, game
directories, extraction, IPC from Electron, or arbitrary file selection.
The CI tests create and open a disposable ZIP with O_NOFOLLOW | O_RDONLY.
"""
from __future__ import annotations

import fcntl
import json
import os
import resource
import stat
import sys
import zlib  # Preload before seccomp prevents lazy module file openings.

# -I/-S avoid site/user paths. The only local package path is our fixed script
# directory, not the working directory, HOME or supplied input.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from controlled_ci_linux_hardening import enforce_no_new_privileges
from controlled_ci_syscall_guard import (enforce_disposable_worker_syscall_guard,
                                          prime_ci_fixture_parser_runtime)
from controlled_ci_fd_inventory import (CiFdInventoryRefused,
                                        verify_exact_inherited_ci_fixture_fds)
from controlled_zip_reader import MAX_ARCHIVE_BYTES, examine_controlled_zip_bytes

CHUNK = 16_384

class ControlledCiFdRefused(ValueError):
    """Never include a user-provided filename or path in the error."""

def refuse():
    raise ControlledCiFdRefused("CONTROLLED_CI_FD_REFUSED")

def _identity(stat_result):
    return (stat_result.st_dev, stat_result.st_ino, stat_result.st_size,
            stat_result.st_mtime_ns, stat_result.st_ctime_ns)

def read_checked_fixture_fd_bytes(fd: int) -> bytes:
    """CI fixture only: copy bytes from an existing read-only regular-file FD.

    The result is UNTRUSTED until a separate bounded format parser accepts it.
    No path is opened here, but FD provenance and a full OS sandbox are NOT
    authenticated; this function must never be exposed to app IPC.
    """
    if type(fd) is not int or not 3 <= fd < 64:
        refuse()
    try:
        before = os.fstat(fd)
        flags = fcntl.fcntl(fd, fcntl.F_GETFL)
        if (flags & os.O_ACCMODE) != os.O_RDONLY:
            refuse()
        if (not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or
                not 0 < before.st_size <= MAX_ARCHIVE_BYTES):
            refuse()
        collected = bytearray()
        offset = 0
        while offset < before.st_size:
            part = os.pread(fd, min(CHUNK, before.st_size - offset), offset)
            if not part:
                refuse()
            collected.extend(part)
            offset += len(part)
            if offset > MAX_ARCHIVE_BYTES:
                refuse()
        after = os.fstat(fd)
        if _identity(before) != _identity(after):
            refuse()
        return bytes(collected)
    except (OSError, OverflowError, MemoryError):
        refuse()


def inspect_open_read_only_fixture_fd(fd: int) -> dict:
    """Inspect an inherited CI fixture FD through the bounded ZIP reader.

    This is not a production sandbox, a user-mod scanner or an assurance
    against concurrent ABA/TOCTOU replacement.
    """
    report = examine_controlled_zip_bytes(read_checked_fixture_fd_bytes(fd))
    return {
        "inputSource": "ci-created-open-readonly-file-descriptor",
        "inputRegularFile": True,
        "inputIdentityStableDuringRead": True,
        "zipReport": report,
        "osSandboxVerified": False,
        "realUserModsInspected": False,
        "installationEnabled": False,
        "writesPerformed": False,
    }

def _main():
    if len(sys.argv) != 3 or sys.argv[1] != "--fixture-fd":
        refuse()
    try:
        fd = int(sys.argv[2], 10)
    except ValueError:
        refuse()
    # Set conservative worker limits; these are resource controls, not
    # OS isolation. The caller also imposes a wall-clock timeout.
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))
    resource.setrlimit(resource.RLIMIT_CPU, (3, 3))
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
    # Explicitly fail closed if kernel hardening cannot be enabled.
    # No-new-privs does not provide OS-level sandbox isolation.
    enforce_no_new_privileges()
    # Additional kernel guard denies new opens/socket/exec in this child only.
    # It does NOT establish a comprehensive operating-system sandbox.
    # Resolve lazy, reviewed Python ZIP helpers on invented in-memory data
    # before denying new file opens. Actual fixture FDs remain unread here.
    prime_ci_fixture_parser_runtime()
    # No other inherited handles, including otherwise unread extra files.
    # This is an inventory check, not file-origin authentication.
    verify_exact_inherited_ci_fixture_fds((fd,))
    enforce_disposable_worker_syscall_guard()
    print(json.dumps(inspect_open_read_only_fixture_fd(fd),
                     sort_keys=True, separators=(",", ":")))

if __name__ == "__main__":
    try:
        _main()
    except Exception as error:
        # Test-only, fixed-category diagnostic; never print exception text,
        # ZIP contents, host paths or process environment values.
        if os.environ.get("CI_FD_LAB_DIAGNOSTIC") == "1":
            if isinstance(error, CiFdInventoryRefused):
                code = error.phase if error.phase in {
                    "GENERAL", "ARGUMENTS", "PROC_ENTRY", "PROC_STAT",
                    "EXTRA", "FD_TYPE", "MISSING", "PROC_FAILURE"
                } else "OTHER"
                print("CI_FD_LAB_INVENTORY_" + code, file=sys.stderr)
                sys.exit(2)
            labels = {"PermissionError", "FileNotFoundError", "LookupError",
                      "RuntimeError", "OSError", "ValueError", "ImportError",
                      "ModuleNotFoundError", "ControlledZipRefused",
                      "ControlledCiFdRefused", "MemoryError"}
            name = type(error).__name__
            print("CI_FD_LAB_ERROR_" + (name if name in labels else "OTHER"),
                  file=sys.stderr)
            sys.exit(2)
        # Do NOT print exception repr, stack trace, file name, input bytes,
        # token, fd contents or host paths to CI logs.
        print("CONTROLLED_CI_FD_REFUSED", file=sys.stderr)
        sys.exit(2)
