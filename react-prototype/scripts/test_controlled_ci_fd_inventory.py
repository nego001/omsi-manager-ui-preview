"""Adversarial inherited-FD tests; only synthetic, disposable Linux files."""
from __future__ import annotations

import os
import socket
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from test_controlled_zip_reader import bundle

SCRIPTS = Path(__file__).resolve().parent
SINGLE = str(SCRIPTS / "controlled_ci_file_reader.py")
GROUP = str(SCRIPTS / "controlled_ci_group_fd_reader.py")


def open_fixture(path: Path) -> int:
    return os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)


def run_worker(worker: str, args: list[str], inherited: tuple[int, ...]):
    return subprocess.run(
        [sys.executable, "-I", "-S", "-B", worker, *args],
        pass_fds=inherited, cwd="/", env={"PYTHONIOENCODING": "utf-8"},
        capture_output=True, text=True, timeout=10, check=False,
    )


@unittest.skipUnless(sys.platform == "linux", "Linux-only procfs FD inventory")
class CiInheritedFdInventoryTests(unittest.TestCase):
    def test_exact_ci_fixture_fd_set_passes_under_seccomp(self):
        with tempfile.TemporaryDirectory(prefix="ci-fd-inventory-") as folder:
            path = Path(folder) / "invented.zip"
            path.write_bytes(bundle([("A/demo.bus", b"[model]\nmodel.cfg\n")]))
            fd = open_fixture(path)
            try:
                response = run_worker(SINGLE, ["--fixture-fd", str(fd)], (fd,))
                self.assertEqual(response.returncode, 0, response.stderr[:110])
                self.assertEqual(response.stderr, "")
                self.assertIn('"osSandboxVerified":false', response.stdout)
            finally:
                os.close(fd)

    def test_single_worker_refuses_unexpected_readonly_inherited_fd(self):
        with tempfile.TemporaryDirectory(prefix="ci-fd-inventory-") as folder:
            valid = Path(folder) / "invented.zip"
            extra = Path(folder) / "extra_secret.zip"
            valid.write_bytes(bundle([("A/demo.bus", b"[model]\nmodel.cfg\n")]))
            extra.write_bytes(bundle([("PRIVATE_PAYLOAD.cfg", b"SECRET_CONTENT")]))
            fd, spare = open_fixture(valid), open_fixture(extra)
            try:
                response = run_worker(
                    SINGLE, ["--fixture-fd", str(fd)], (fd, spare))
                self.assertEqual(response.returncode, 2)
                self.assertEqual(response.stdout, "")
                self.assertEqual(response.stderr.strip(),
                                 "CONTROLLED_CI_FD_REFUSED")
                self.assertNotIn("PRIVATE_PAYLOAD", response.stderr)
                self.assertNotIn(str(extra), response.stderr)
            finally:
                os.close(fd)
                os.close(spare)

    def test_group_worker_refuses_third_undeclared_readonly_fd(self):
        with tempfile.TemporaryDirectory(prefix="ci-fd-inventory-") as folder:
            values = [
                bundle([("A/first.bus", b"[model]\nmodel.cfg\n")]),
                bundle([("A/model.cfg", b"CI-only")]),
                bundle([("PRIVATE_EXTRA.cfg", b"SECRET_CONTENT")]),
            ]
            fds = []
            try:
                for index, data in enumerate(values):
                    path = Path(folder) / f"fiction_{index}.zip"
                    path.write_bytes(data)
                    fds.append(open_fixture(path))
                result = run_worker(
                    GROUP, ["--fixture-fds", str(fds[0]), str(fds[1])],
                    tuple(fds))
                self.assertEqual(result.returncode, 2)
                self.assertEqual(result.stdout, "")
                self.assertEqual(result.stderr.strip(),
                                 "CONTROLLED_CI_GROUP_FD_REFUSED")
                self.assertNotIn("PRIVATE_EXTRA", result.stderr)
            finally:
                for fd in fds:
                    os.close(fd)


    def test_single_worker_refuses_inherited_socket_even_when_seccomp_blocks_creation(self):
        # An already-open socket could evade a rule that merely blocks socket().
        # Reject the unexpected inherited socket before ZIP parsing instead.
        with tempfile.TemporaryDirectory(prefix="ci-fd-inventory-") as folder:
            path = Path(folder) / "invented.zip"
            path.write_bytes(bundle([("A/demo.bus", b"[model]\\nmodel.cfg\\n")]))
            fd = open_fixture(path)
            local, remote = socket.socketpair()
            try:
                result = run_worker(
                    SINGLE, ["--fixture-fd", str(fd)],
                    (fd, local.fileno()))
                self.assertEqual(result.returncode, 2)
                self.assertEqual(result.stdout, "")
                self.assertEqual(result.stderr.strip(), "CONTROLLED_CI_FD_REFUSED")
            finally:
                local.close()
                remote.close()
                os.close(fd)


if __name__ == "__main__":
    unittest.main()
