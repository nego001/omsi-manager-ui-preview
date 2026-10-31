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
import tempfile
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

    def test_existing_disposable_file_metadata_cannot_be_mutated(self):
        # Unlike open() denials, chmod/utime/truncate can act by pathname
        # without opening a new FD. Block them in a child and verify the
        # caller-owned synthetic file remains byte-for-byte identical.
        with tempfile.TemporaryDirectory(prefix="ci-seccomp-meta-") as root:
            file = Path(root) / "invented.txt"
            extra = Path(root) / "must-not-appear"
            payload = b"synthetic-ci-only"
            file.write_bytes(payload)
            file.chmod(0o600)
            previous = file.stat()
            fd = os.open(file, os.O_RDONLY | os.O_CLOEXEC)
            code = """
import errno,os,sys
sys.path.insert(0,sys.argv[1])
from controlled_ci_syscall_guard import enforce_disposable_worker_syscall_guard
path,extra,fd=sys.argv[2],sys.argv[3],int(sys.argv[4])
enforce_disposable_worker_syscall_guard()
ops=(
    lambda:os.chmod(path,0o777),
    lambda:os.utime(path,None),
    lambda:os.truncate(path,0),
    lambda:os.link(path,extra),
    lambda:os.symlink(path,extra),
    lambda:os.fchmod(fd,0o777),
)
for op in ops:
    try:
        op()
    except OSError as error:
        if error.errno != errno.EPERM:
            sys.exit(3)
    else:
        sys.exit(4)
print("CI_FS_MUTATIONS_DENIED")
"""
            try:
                result = subprocess.run(
                    [sys.executable, "-I", "-S", "-B", "-c", code,
                     SCRIPTS, str(file), str(extra), str(fd)],
                    pass_fds=(fd,), cwd="/",
                    env={"PYTHONIOENCODING": "utf-8"},
                    capture_output=True, text=True, timeout=8, check=False,
                )
            finally:
                os.close(fd)
            self.assertEqual(result.returncode, 0, result.stderr[:100])
            self.assertEqual(result.stdout.strip(), "CI_FS_MUTATIONS_DENIED")
            self.assertEqual(result.stderr, "")
            self.assertEqual(file.read_bytes(), payload)
            self.assertEqual(file.stat().st_mode, previous.st_mode)
            self.assertEqual(file.stat().st_mtime_ns, previous.st_mtime_ns)
            self.assertFalse(extra.exists() or extra.is_symlink())

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
