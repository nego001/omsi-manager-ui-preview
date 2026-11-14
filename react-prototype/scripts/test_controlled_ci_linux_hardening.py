"""Kernel no_new_privs gate tests using disposable CI subprocesses only.

These tests do NOT certify process isolation, file restrictions or safe parsing
of arbitrary user ZIP files. No game directories or user data are inspected.
"""
from __future__ import annotations

import ctypes
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

from controlled_ci_linux_hardening import (
    CiLinuxHardeningRefused, enforce_no_new_privileges,
)

SCRIPTS = str(Path(__file__).resolve().parent)


@unittest.skipUnless(sys.platform.startswith("linux"), "Linux kernel primitive only")
class CiNoNewPrivilegesTests(unittest.TestCase):
    def test_isolated_child_enforces_and_verifies_kernel_bit(self):
        script = (
            "import ctypes,sys\n"
            "sys.path.insert(0, sys.argv[1])\n"
            "from controlled_ci_linux_hardening import enforce_no_new_privileges\n"
            "enforce_no_new_privileges()\n"
            "enforce_no_new_privileges()\n"
            "libc=ctypes.CDLL(None,use_errno=True)\n"
            "libc.prctl.argtypes=[ctypes.c_int,ctypes.c_ulong,ctypes.c_ulong,"
            "ctypes.c_ulong,ctypes.c_ulong]\n"
            "libc.prctl.restype=ctypes.c_int\n"
            "assert libc.prctl(39,0,0,0,0)==1\n"
            "print('CI_NNP_VERIFIED')\n"
        )
        result = subprocess.run(
            [sys.executable, "-I", "-S", "-B", "-c", script, SCRIPTS],
            cwd="/", env={"PYTHONIOENCODING": "utf-8"},
            capture_output=True, text=True, timeout=8, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr[:120])
        self.assertEqual(result.stdout.strip(), "CI_NNP_VERIFIED")
        self.assertEqual(result.stderr, "")

    def test_missing_prctl_refuses_without_host_details(self):
        with patch("controlled_ci_linux_hardening.ctypes.CDLL",
                   side_effect=OSError("PRIVATE_KERNEL_DETAIL")):
            with self.assertRaisesRegex(CiLinuxHardeningRefused,
                                        "^CI_LINUX_HARDENING_REFUSED$") as caught:
                enforce_no_new_privileges()
        self.assertNotIn("PRIVATE_KERNEL_DETAIL", str(caught.exception))

    def test_positive_bit_never_claims_full_sandbox(self):
        # Exact contract deliberately continues to report no OS sandbox.
        from controlled_ci_group_fd_reader import inspect_open_fixture_group_fds
        from controlled_ci_file_reader import inspect_open_read_only_fixture_fd
        self.assertTrue(callable(inspect_open_fixture_group_fds))
        self.assertTrue(callable(inspect_open_read_only_fixture_fd))
        self.assertNotIn("osSandboxVerified", enforce_no_new_privileges.__doc__ or "")


if __name__ == "__main__":
    unittest.main()
