"""M19: two pinned repo revisions compare only identical in-memory CI ZIPs.

This orchestrator is confined to GitHub-hosted CI and two fixed checkout
directories. It never accepts caller paths, external mod ZIPs, game folders,
or arbitrary commit refs. The child execution is limited to the analyzer
scripts of each checked-out revision in isolated Python processes.

Only static labels/counts leave the probes. ZIP bytes, fingerprints, file
names and diagnostic internals are not logged, uploaded or returned. Results
are NOT authentic signatures and do not approve mods or installation.
"""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import io
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import zipfile

# The CI entrypoint runs with -I: Python deliberately removes the script
# directory from sys.path. Add only the directory containing THIS checked-out
# entrypoint, not PYTHONPATH, cwd, site-packages or a user-selected root.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from controlled_fixture_regression_guard import (
    GROUPS, SyntheticFixtureSnapshot, compare_synthetic_fixture_snapshots
)

MAX_SYNTHETIC_PROBE_BYTES = 2_000_000
MAX_PROBE_OUTPUT_BYTES = 16_384
REVISION_PROBE_SCHEMA = "synthetic-two-revision-comparison-v1"

# This code is deliberately held by the candidate CI orchestrator and run in
# a new interpreter for EACH checkout; no baseline-specific runner is needed.
# Isolated (-I -S -B) Python with only this checkout's scripts prepended to
# sys.path. Same exact byte payload is sent to BOTH probes via stdin.
PROBE = r"""
import json
import sys
from pathlib import Path
scripts = Path(sys.argv[1]).resolve(strict=True)
if scripts.name != "scripts" or scripts.parent.name != "react-prototype":
    raise SystemExit(2)
sys.path.insert(0, str(scripts))
from controlled_fixture_regression_guard import capture_synthetic_fixture_snapshot
payload = sys.stdin.buffer.read(2000001)
if not 0 < len(payload) <= 2000000:
    raise SystemExit(3)
snapshot = capture_synthetic_fixture_snapshot(payload)
print(json.dumps([value for _, value in snapshot.groups],
                 separators=(",", ":"), allow_nan=False))
"""


def _refuse():
    raise ValueError("CONTROLLED_CI_REVISION_DIFF_REFUSED")


def _freeze(element: object, depth: int = 0):
    # Strictly limit JSON shape, even though both revisions belong to the
    # repo; no file names, unknown mapping keys, non-finite floats or objects.
    if depth > 5:
        _refuse()
    if type(element) is list:
        if len(element) > 512:
            _refuse()
        return tuple(_freeze(part, depth + 1) for part in element)
    if type(element) in (str, int, bool):
        if type(element) is str and len(element) > 128:
            _refuse()
        return element
    _refuse()


def _decode_probe(payload: bytes, wire: bytes) -> SyntheticFixtureSnapshot:
    if (type(payload) is not bytes or len(payload) > MAX_SYNTHETIC_PROBE_BYTES
            or type(wire) is not bytes or
            not 0 < len(wire) <= MAX_PROBE_OUTPUT_BYTES):
        _refuse()
    try:
        raw = json.loads(wire)
    except (UnicodeError, ValueError, TypeError):
        _refuse()
    if type(raw) is not list or len(raw) != len(GROUPS):
        _refuse()
    values = tuple(_freeze(part) for part in raw)
    return SyntheticFixtureSnapshot(
        hashlib.sha256(payload).digest(), tuple(zip(GROUPS, values)))


def _probe_checkout(scripts: Path, payload: bytes) -> SyntheticFixtureSnapshot:
    if (not isinstance(scripts, Path) or scripts.name != "scripts"
            or scripts.parent.name != "react-prototype"
            or not scripts.is_dir()):
        _refuse()
    try:
        completed = subprocess.run(
            [sys.executable, "-I", "-S", "-B", "-c", PROBE, str(scripts)],
            input=payload,
            capture_output=True,
            check=False,
            timeout=25,
            env={"PYTHONDONTWRITEBYTECODE": "1", "PYTHONIOENCODING": "utf-8"},
            cwd=scripts,
        )
    except (OSError, subprocess.TimeoutExpired):
        _refuse()
    # Never print stderr: it could contain paths/code from a failed child.
    if completed.returncode != 0:
        _refuse()
    return _decode_probe(payload, completed.stdout)


def compare_two_revision_probes(
        fixture: bytes, first_wire: bytes, second_wire: bytes) -> dict:
    """Compare strictly bounded outputs; invalid snapshots fail closed."""
    before = _decode_probe(fixture, first_wire)
    after = _decode_probe(fixture, second_wire)
    try:
        diff = compare_synthetic_fixture_snapshots(before, after)
    except ValueError:
        _refuse()
    return {
        "comparison": diff["comparison"],
        "changedContractGroups": list(diff["changedContractGroups"]),
        "sameSyntheticZipBytesCompared": True,
        "changeIsAutomaticallyProvenRegression": False,
        "baselineAuthenticityEstablished": False,
        "realModValidated": False,
        "installationAuthorized": False,
    }


def _zip(entries: tuple[tuple[str, bytes], ...]) -> bytes:
    # No filesystem, no source-supplied inputs; stable timestamps to keep
    # fixture bytes identical for both independent revision probes.
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as arc:
        for name, data in entries:
            info = zipfile.ZipInfo(name, date_time=(2024, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            arc.writestr(info, data)
    result = output.getvalue()
    if not 0 < len(result) <= MAX_SYNTHETIC_PROBE_BYTES:
        _refuse()
    return result


ROOT = "Vehicles/ControlledM19/"
BUS = b"[model]\nmodel/model.cfg\n"
CFG = b"[mesh]\nbody.o3d\n"
SII = b"SiiNunit\n{\nvehicle : fake.truck\n}\n"


def _matrix_mesh(optional_bones: bool) -> bytes:
    # Entirely original artificial mesh bytes: 3 vertices, 1 triangle,
    # 1 opaque material and a finite identity-matrix layout.
    vertex = struct.pack("<8f", 1, 2, 3, 0, 0, 1, 0.25, 0.5)
    floats = struct.pack("<11f", 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 2)
    matrix = struct.pack("<16f",
                         1, 0, 0, 0, 0, 1, 0, 0,
                         0, 0, 1, 0, 0, 0, 0, 1)
    header = b"\x84\x19\x05\x00" + bytes(4)
    mesh = (header + b"\x17" + (3).to_bytes(4, "little") +
            vertex * 3 + b"\x49" + (1).to_bytes(4, "little") +
            (0).to_bytes(2, "little") + (1).to_bytes(2, "little") +
            (2).to_bytes(2, "little") + (0).to_bytes(2, "little") +
            b"\x26" + (1).to_bytes(2, "little") +
            floats + b"\x07FakeMat" + b"\x79" + matrix)
    if optional_bones:
        return mesh + (
            b"\x54" + (1).to_bytes(2, "little") +
            b"\x04Bone" + (1).to_bytes(2, "little") +
            (0).to_bytes(2, "little") + struct.pack("<f", 0.75))
    return mesh


def ci_synthetic_fixtures() -> tuple[bytes, ...]:
    """Nine fixed fixtures, no raw user files, no path input, no network."""
    candidate = (
        (ROOT + "A.bus", BUS),
        (ROOT + "model/model.cfg", CFG),
        (ROOT + "model/body.o3d", b"INVALID_ON_PURPOSE"),
    )
    return (
        _zip(candidate),
        _zip(candidate + (("def/truck.sii", SII),)),
        _zip(candidate[:2]),
        _zip(((ROOT + "A.bus", b"[model]\nmodel/missing.cfg\n"),
              (ROOT + "model/model.cfg", CFG))),
        _zip(((ROOT + "A.bus", BUS),)),
        _zip((("def/truck.sii", SII),)),
        _zip((("docs.txt", b"CI_ONLY_NOT_REAL_MOD"),)),
        _zip(candidate[:2] + ((ROOT + "model/body.o3d", _matrix_mesh(False)),)),
        _zip(candidate[:2] + ((ROOT + "model/body.o3d", _matrix_mesh(True)),)),
    )


def run_ci_two_revision_comparison(
        baseline_scripts: Path, candidate_scripts: Path) -> dict:
    """Fail closed if any fixture contract changed or an isolated probe failed.

    Executed ONLY by the dedicated GitHub Actions test job with two fixed
    checkouts, not by the product's archive-reading code.
    """
    if (not isinstance(baseline_scripts, Path) or
            not isinstance(candidate_scripts, Path) or
            baseline_scripts == candidate_scripts):
        _refuse()
    fixtures = ci_synthetic_fixtures()
    changed = set()
    stable = 0
    for fixture in fixtures:
        first = _probe_checkout(baseline_scripts, fixture)
        second = _probe_checkout(candidate_scripts, fixture)
        try:
            diff = compare_synthetic_fixture_snapshots(first, second)
        except ValueError:
            _refuse()
        if diff["comparison"] == "stable":
            stable += 1
        else:
            changed.update(diff["changedContractGroups"])
    return {
        "schema": REVISION_PROBE_SCHEMA,
        "comparison": "reviewRequired" if changed else "stable",
        "syntheticFixturesCompared": len(fixtures),
        "stableSyntheticFixtures": stable,
        "changedContractGroups": sorted(changed),
        "twoIndependentRevisionProcessesUsed": True,
        "sameSyntheticZipBytesCompared": True,
        "baselineAuthenticityEstablished": False,
        "changeIsAutomaticallyProvenRegression": False,
        "realModValidated": False,
        "installationAuthorized": False,
    }


def main():
    # CLI takes NO arguments or archive inputs. Paths are fixed to separately
    # checked out versions in the GitHub-hosted ephemeral workspace.
    if (os.environ.get("GITHUB_ACTIONS") != "true"
            or os.environ.get("CI") != "true"
            or len(sys.argv) != 1):
        _refuse()
    workspace = Path.cwd()
    baseline = workspace / "baseline" / "react-prototype" / "scripts"
    candidate = workspace / "candidate" / "react-prototype" / "scripts"
    result = run_ci_two_revision_comparison(baseline, candidate)
    print(json.dumps(result, sort_keys=True, separators=(",", ":")))
    if result["comparison"] != "stable":
        raise SystemExit(1)


if __name__ == "__main__":
    try:
        main()
    except ValueError:
        print("CONTROLLED_CI_REVISION_DIFF_REFUSED", file=sys.stderr)
        raise SystemExit(1)
