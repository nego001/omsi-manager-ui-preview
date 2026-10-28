"""Emit one anonymous CI-only end-to-end multi-ZIP FD evidence sample.

Requires hosted CI identity flags. Creates fake ZIPs in an exclusive temporary
directory, opens each read-only without following symlinks and hands only
already-open descriptors to a separate restricted Python worker.

Output is a bounded JSON count envelope. No user mod, game, project workspace
file, filesystem pathname or archive payload appears in the output.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

# -I omits the script directory, so import exclusively from this fixed,
# reviewed CI scripts folder. Never import from HOME, cwd or ZIP contents.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_controlled_zip_reader import bundle
from controlled_ci_group_fd_reader import MAX_PACKAGES

WORKER = str(Path(__file__).with_name("controlled_ci_group_fd_reader.py"))


def main() -> int:
    if (sys.platform != "linux" or os.environ.get("CI") != "true"
            or os.environ.get("GITHUB_ACTIONS") != "true"
            or os.geteuid() == 0):
        return 3
    payloads = (
        bundle([("Vehicles/Demo/sample.bus",
                 b"[model]\nmodel.cfg\n[mesh]\nbody.o3d\n"
                 b"[texture]\nmissing.dds\n")]),
        bundle([("Vehicles/Demo/model.cfg", b"fiction-only"),
                ("Vehicles/Demo/body.o3d", b"not actual game geometry")]),
        bundle([("Vehicles/Demo/model.cfg", b"another fiction-only file")]),
    )
    assert len(payloads) <= MAX_PACKAGES
    with tempfile.TemporaryDirectory(prefix="ci-fd-evidence-") as temporary:
        fds = []
        try:
            for index, payload in enumerate(payloads):
                path = Path(temporary) / f"ci-fixture-{index}.zip"
                path.write_bytes(payload)
                path.chmod(0o600)
                fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW |
                             os.O_CLOEXEC | os.O_NONBLOCK)
                fds.append(fd)
            # FD-only worker: no pathname parameters, shell or inherited HOME.
            result = subprocess.run(
                [sys.executable, "-I", "-S", "-B", WORKER,
                 "--fixture-fds", *(str(fd) for fd in fds)],
                pass_fds=tuple(fds), cwd="/",
                env={"PYTHONIOENCODING": "utf-8"},
                capture_output=True, text=True, timeout=10, check=False,
            )
            if result.returncode != 0 or result.stderr or len(result.stdout) > 30000:
                return 2
            envelope = json.loads(result.stdout)
            if (envelope.get("inputCount") != 3 or
                    envelope.get("osSandboxVerified") is not False or
                    envelope.get("realUserModsInspected") is not False or
                    envelope.get("installationEnabled") is not False):
                return 2
            # Emit only canonical counts, no filenames. The TS adapter will
            # independently enforce the exact field schema and all totals.
            print(json.dumps(envelope, sort_keys=True, separators=(",", ":")))
            return 0
        finally:
            for fd in fds:
                os.close(fd)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        print("CONTROLLED_CI_FD_EVIDENCE_REFUSED", file=sys.stderr)
        sys.exit(2)
