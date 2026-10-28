"""Linux x86_64 CI-only syscall-deny guard for disposable ZIP workers.

Seccomp-BPF prevents newly opening paths, creating sockets and executing
programs *after* an inherited read-only FD has been passed to the worker.
Not a complete sandbox: inherited descriptors, ptrace by other processes,
memory access and many syscalls are NOT isolated. NEVER use this as proof
that arbitrary user mods are safe or that full OS sandboxing is verified.
"""
from __future__ import annotations

import ctypes
import errno
import os
import sys

from controlled_ci_linux_hardening import enforce_no_new_privileges

# Linux constants from uapi linux/prctl.h, linux/seccomp.h, linux/filter.h.
PR_SET_SECCOMP = 22
SECCOMP_MODE_FILTER = 2
BPF_LD_W_ABS = 0x20
BPF_JMP_JEQ_K = 0x15
BPF_JMP_JGE_K = 0x35
BPF_RET_K = 0x06
AUDIT_ARCH_X86_64 = 0xC000003E
X32_SYSCALL_BIT = 0x40000000
SECCOMP_RET_KILL_PROCESS = 0x80000000
SECCOMP_RET_ERRNO = 0x00050000
SECCOMP_RET_ALLOW = 0x7FFF0000
_DENIED = SECCOMP_RET_ERRNO | errno.EPERM

# Stable Linux x86_64 syscall numbers. New file opens, new network sockets
# and exec are forbidden. The worker can still read its already-open ZIP FD.
# This is a bounded denylist, NOT a comprehensive syscall allowlist.
_BLOCKED_SYSCALLS = (
    2,    # open
    41,   # socket
    42,   # connect
    43,   # accept
    44,   # sendto
    45,   # recvfrom
    46,   # sendmsg
    47,   # recvmsg
    49,   # bind
    50,   # listen
    53,   # socketpair
    56,   # clone
    57,   # fork
    58,   # vfork
    59,   # execve
    82,   # rename
    83,   # mkdir
    84,   # rmdir
    85,   # creat
    87,   # unlink
    101,  # ptrace
    257,  # openat
    258,  # mkdirat
    263,  # unlinkat
    264,  # renameat
    288,  # accept4
    299,  # recvmmsg
    307,  # sendmmsg
    316,  # renameat2
    322,  # execveat
    435,  # clone3
    437,  # openat2
)
assert len(_BLOCKED_SYSCALLS) == len(set(_BLOCKED_SYSCALLS))


class CiSyscallGuardRefused(ValueError):
    pass


class _SockFilter(ctypes.Structure):
    _fields_ = [
        ("code", ctypes.c_ushort),
        ("jt", ctypes.c_ubyte),
        ("jf", ctypes.c_ubyte),
        ("k", ctypes.c_uint32),
    ]


class _SockFprog(ctypes.Structure):
    _fields_ = [
        ("len", ctypes.c_ushort),
        ("filter", ctypes.POINTER(_SockFilter)),
    ]



def prime_ci_fixture_parser_runtime() -> None:
    """Exercise a fixed, invented DEFLATE ZIP entirely in memory BEFORE seccomp.

    Python may lazily load codecs and ZIP helpers. Under the kernel openat deny
    filter, such imports cannot occur. This makes those imports happen from
    reviewed Python modules before processing any external fixture descriptor.
    A new or unhandled lazy import still fails closed after seccomp.
    """
    try:
        import io
        import zipfile
        from controlled_zip_reader import examine_controlled_zip_bytes
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("A/invented.bus",
                             b"[model]\\nmodel.cfg\\n[mesh]\\npart.o3d\\n")
            archive.writestr("A/model.cfg", b"[mesh]\\npart.o3d\\n")
            archive.writestr("A/part.o3d", b"ci-fixture-only")
        inspected = examine_controlled_zip_bytes(buffer.getvalue())
        if (inspected["fileCount"] != 3 or
                inspected["zipHeadersAndCrcRead"] is not True or
                inspected["realGameFilesTouched"] is not False):
            raise CiSyscallGuardRefused("CI_SYSCALL_GUARD_REFUSED")
    except Exception:
        # No error string, file path or generated ZIP bytes may be exposed.
        raise CiSyscallGuardRefused("CI_SYSCALL_GUARD_REFUSED") from None


def enforce_disposable_worker_syscall_guard() -> None:
    """Install a fail-closed seccomp deny filter in this CI subprocess.

    Must run only after all imports and FD setup; seccomp restrictions are
    irreversible until the worker exits. No paths, ZIP data or host errors
    enter the exception.
    """
    if sys.platform != "linux" or os.uname().machine != "x86_64":
        raise CiSyscallGuardRefused("CI_SYSCALL_GUARD_REFUSED")

    # Seccomp unprivileged filters require this bit; it is verified separately.
    try:
        enforce_no_new_privileges()
        instructions = [
            (BPF_LD_W_ABS, 0, 0, 4),             # seccomp_data.arch
            (BPF_JMP_JEQ_K, 1, 0, AUDIT_ARCH_X86_64),
            (BPF_RET_K, 0, 0, SECCOMP_RET_KILL_PROCESS),
            (BPF_LD_W_ABS, 0, 0, 0),             # seccomp_data.nr
            (BPF_JMP_JGE_K, 0, 1, X32_SYSCALL_BIT),
            (BPF_RET_K, 0, 0, _DENIED),
        ]
        for number in _BLOCKED_SYSCALLS:
            instructions.extend([
                (BPF_JMP_JEQ_K, 0, 1, number),
                (BPF_RET_K, 0, 0, _DENIED),
            ])
        instructions.append((BPF_RET_K, 0, 0, SECCOMP_RET_ALLOW))
        program_type = _SockFilter * len(instructions)
        program_data = program_type(*(_SockFilter(*inst) for inst in instructions))
        program = _SockFprog(len(instructions), program_data)
        libc = ctypes.CDLL(None, use_errno=True)
        prctl = libc.prctl
        prctl.argtypes = [ctypes.c_int, ctypes.c_ulong, ctypes.c_ulong,
                          ctypes.c_ulong, ctypes.c_ulong]
        prctl.restype = ctypes.c_int
        if prctl(PR_SET_SECCOMP, SECCOMP_MODE_FILTER,
                 ctypes.addressof(program), 0, 0) != 0:
            raise CiSyscallGuardRefused("CI_SYSCALL_GUARD_REFUSED")
    except (AttributeError, OSError, TypeError, ValueError):
        raise CiSyscallGuardRefused("CI_SYSCALL_GUARD_REFUSED") from None
