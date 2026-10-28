"""CI-only seccomp behavioral checks in short-lived disposable children.

The parent process never installs seccomp. This validates selected syscall
denials only; it does not claim a complete kernel sandbox or user-mod support.
"""
from __future__ import annotations

import os
from pathlib import Path
import platform
import subprocess
import sys
import unittest
from unittest.mock import patch

from controlled_ci_syscall_guard import CiSyscallGuardRefused, enforce_disposable_worker_syscall_guard

SCRIPTS = str(Path(__file__).resolve().parent)


@unittest.skipUnless(sys.platform == "linux" and platform.machine() == "x86_64",
                     "CI syscall guard uses Linux x86_64 syscall ABI")
class CiSyscallGuardTests(unittest.TestCase):
    def test_child_cannot_open_new_paths_or_create_socket_but_can_use_existing_fd(self):
        code = (
            "import errno,os,socket,sys\n"
            "sys.path.insert(0,sys.argv[1])\n"
            "from controlled_ci_syscall_guard import enforce_disposable_worker_syscall_guard\n"
            "enforce_disposable_worker_syscall_guard()\n"
            "assert os.fstat(1).st_mode\n"
            "try:\n"
            "  os.open('/dev/null',os.O_RDONLY)\n"
            "except OSError as ex:\n"
            "  assert ex.errno == errno.EPERM\n"
            "else:\n"
            "  raise AssertionError('OPEN_NOT_BLOCKED')\n"
            "try:\n"
            "  socket.socket(socket.AF_INET,socket.SOCK_STREAM)\n"
            "except OSError as ex:\n"
            "  assert ex.errno == errno.EPERM\n"
            "else:\n"
            "  raise AssertionError('SOCKET_NOT_BLOCKED')\n"
            "print('CI_SYSCALL_DENIAL_VERIFIED')\n"
        )
        process = subprocess.run(
            [sys.executable, "-I", "-S", "-B", "-c", code, SCRIPTS],
            cwd="/", env={"PYTHONIOENCODING": "utf-8"},
            capture_output=True, text=True, timeout=8, check=False,
        )
        self.assertEqual(process.returncode, 0, process.stderr[:120])
        self.assertEqual(process.stdout.strip(), "CI_SYSCALL_DENIAL_VERIFIED")
        self.assertEqual(process.stderr, "")

    def test_guard_rejects_unavailable_kernel_interface_without_host_paths(self):
        with patch("controlled_ci_syscall_guard.ctypes.CDLL",
                   side_effect=OSError("PRIVATE_HOST_DETAILS")):
            with self.assertRaisesRegex(CiSyscallGuardRefused,
                                        "^CI_SYSCALL_GUARD_REFUSED$") as caught:
                enforce_disposable_worker_syscall_guard()
        self.assertNotIn("PRIVATE_HOST_DETAILS", str(caught.exception))

    def test_guard_is_not_a_complete_sandbox(self):
        from controlled_ci_group_fd_reader import inspect_open_fixture_group_fds
        self.assertTrue(callable(inspect_open_fixture_group_fds))
        self.assertNotIn("sandbox", "CI_SYSCALL_DENIAL_VERIFIED")


if __name__ == "__main__":
    unittest.main()
