"""Linux CI worker hardening: deny privilege gains on exec.

PR_SET_NO_NEW_PRIVS is a kernel security prerequisite, NOT a filesystem,
network, syscall, container or seccomp sandbox. Do not advertise it as such.
It can be set only in the disposable Python CI workers, before ZIP parsing.
"""
from __future__ import annotations

import ctypes
import sys

PR_SET_NO_NEW_PRIVS = 38
PR_GET_NO_NEW_PRIVS = 39


class CiLinuxHardeningRefused(ValueError):
    pass


def enforce_no_new_privileges() -> None:
    """Set and verify the irreversible per-thread Linux no_new_privs bit.

    Never continue on unknown platforms or syscall errors. This is only one
    hardening layer and does not authorize reading untrusted user mods.
    """
    if not sys.platform.startswith("linux"):
        raise CiLinuxHardeningRefused("CI_LINUX_HARDENING_REFUSED")
    try:
        libc = ctypes.CDLL(None, use_errno=True)
        prctl = libc.prctl
        prctl.argtypes = [ctypes.c_int, ctypes.c_ulong, ctypes.c_ulong,
                          ctypes.c_ulong, ctypes.c_ulong]
        prctl.restype = ctypes.c_int
        if prctl(PR_SET_NO_NEW_PRIVS, 1, 0, 0, 0) != 0:
            raise CiLinuxHardeningRefused("CI_LINUX_HARDENING_REFUSED")
        if prctl(PR_GET_NO_NEW_PRIVS, 0, 0, 0, 0) != 1:
            raise CiLinuxHardeningRefused("CI_LINUX_HARDENING_REFUSED")
    except (AttributeError, OSError, TypeError, ValueError):
        raise CiLinuxHardeningRefused("CI_LINUX_HARDENING_REFUSED") from None
