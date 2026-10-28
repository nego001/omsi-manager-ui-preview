"""CI ONLY: compare two to four already-open disposable ZIP fixture files.

No filesystem pathname inputs, archive extraction, package installation,
user mods, Electron IPC, or production sandbox claims. Files originate from
the tests' exclusive temporary directory and are opened read-only by them.
"""
from __future__ import annotations

import json
import os
import re
import resource
import sys
import zlib  # Preload before seccomp prevents lazy module file openings.

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from controlled_ci_file_reader import (
    ControlledCiFdRefused, read_checked_fixture_fd_bytes,
)
from controlled_fixture_group import (
    MAX_PACKAGES, MAX_COMBINED_INPUT_BYTES, examine_fixture_group,
)
from controlled_ci_linux_hardening import enforce_no_new_privileges
from controlled_ci_syscall_guard import (enforce_disposable_worker_syscall_guard,
                                          prime_ci_fixture_parser_runtime)
from controlled_ci_fd_inventory import verify_exact_inherited_ci_fixture_fds
from controlled_zip_reader import ControlledZipRefused


class ControlledCiGroupFdRefused(ValueError):
    pass


def refuse():
    raise ControlledCiGroupFdRefused("CONTROLLED_CI_GROUP_FD_REFUSED")


def inspect_open_fixture_group_fds(fds: tuple[int, ...]) -> dict:
    """Return only anonymous, count-based cross-ZIP evidence from CI files.

    Each FD is an inherited regular file descriptor, never a pathname.
    Stable fstat identity is only a during-read observation, not proof of
    immutable content or defense against all ABA/TOCTOU attacks.
    """
    if (type(fds) is not tuple or not 2 <= len(fds) <= MAX_PACKAGES
            or any(type(fd) is not int or fd < 3 or fd >= 64 for fd in fds)
            or len(set(fds)) != len(fds)):
        refuse()
    payloads = []
    identities = set()
    try:
        for fd in fds:
            st = os.fstat(fd)
            identity = (st.st_dev, st.st_ino)
            if identity in identities:
                refuse()
            identities.add(identity)
            payloads.append(read_checked_fixture_fd_bytes(fd))
            if sum(map(len, payloads)) > MAX_COMBINED_INPUT_BYTES:
                refuse()
        report = examine_fixture_group(tuple(payloads))
    except (ControlledCiFdRefused, ControlledZipRefused, OSError,
            OverflowError, MemoryError):
        refuse()
    return {
        "inputSource": "ci-created-open-readonly-file-descriptors",
        "mode": "ci-disposable-zip-file-crosscheck",
        "inputCount": len(fds),
        "report": report,
        "osSandboxVerified": False,
        "fdOriginAuthenticated": False,
        "realUserModsInspected": False,
        "gameCompatibilityVerified": False,
        "installationEnabled": False,
        "writesPerformed": False,
    }


def _main():
    if (len(sys.argv) < 4 or len(sys.argv) > 2 + MAX_PACKAGES
            or sys.argv[1] != "--fixture-fds"
            or any(not re.fullmatch(r"[0-9]{1,2}", value, re.ASCII)
                   for value in sys.argv[2:])):
        refuse()
    fds = tuple(int(value) for value in sys.argv[2:])
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))
    resource.setrlimit(resource.RLIMIT_CPU, (4, 4))
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024,
                                             256 * 1024 * 1024))
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
    verify_exact_inherited_ci_fixture_fds(fds)
    enforce_disposable_worker_syscall_guard()
    print(json.dumps(inspect_open_fixture_group_fds(fds),
                     sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    try:
        _main()
    except Exception:
        # No repr, traceback, file names, archive bytes or host paths in logs.
        print("CONTROLLED_CI_GROUP_FD_REFUSED", file=sys.stderr)
        sys.exit(2)
