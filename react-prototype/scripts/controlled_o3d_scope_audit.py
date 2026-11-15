"""M16: fail-closed, package-local provenance consistency for synthetic O3D hints.

This is NOT authenticity, signature verification, OMSI format certification or
a production parser. The caller supplies the vetted in-memory ZIP entry index
and per-entry M15 labels from ONE invocation. No names/paths/bytes are returned.
"""
from __future__ import annotations

import hashlib

from controlled_o3d_evidence_coordinator import O3D_EVIDENCE_STATES

STAGES = ("header", "vertex", "triangle", "material", "matrix", "bone",
          "optionalBoneAbsent")
LINKS = ("linked", "mesh", "header", "vertex", "triangle", "material",
         "matrix", "bone", "optionalBoneAbsent")
DEPTH = {
    "noSupportedHeader": -1,
    "headerOnly": 0,
    "vertexLayoutOnly": 1,
    "triangleIndexOnly": 2,
    "materialLayoutOnly": 3,
    "matrixWithOptionalBonesAbsent": 4,
    "matrixWithBoneSectionOutsideBudget": 4,
    "matrixWithBonesUnconfirmed": 4,
    "boundedBoneLayoutObserved": 5,
}
MAX_CONTROLLED_O3D_ENTRIES = 128
RECEIPT_DOMAIN = b"OMSI_CONTROLLED_SYNTHETIC_SCOPE_V1\x00"


def make_synthetic_entry_receipt(archive_digest: bytes,
                                 path: str, entry_digest: bytes) -> bytes:
    """In-memory binding only, NOT an authenticated signature."""
    if (type(archive_digest) is not bytes or len(archive_digest) != 32 or
            type(path) is not str or not path or not path.isascii() or
            path != path.lower() or
            type(entry_digest) is not bytes or len(entry_digest) != 32):
        refuse()
    raw = path.encode("ascii", errors="strict")
    if len(raw) > 160:
        refuse()
    return hashlib.sha256(
        RECEIPT_DOMAIN + archive_digest + len(raw).to_bytes(2, "big") +
        raw + entry_digest
    ).digest()


class ControlledO3dScopeRefused(ValueError):
    """Fixed message only; never echo caller-supplied paths or labels."""


def refuse():
    raise ControlledO3dScopeRefused("CONTROLLED_O3D_SCOPE_REFUSED")


def audit_synthetic_o3d_scope(
        vetted_zip_paths: frozenset[str],
        stage_paths: dict[str, frozenset[str]],
        entry_states: dict[str, str],
        public_counts: dict[str, int],
        linked_variants: dict[str, frozenset[str]],
        archive_digest: bytes,
        entry_digests: dict[str, bytes],
        entry_receipts: dict[str, bytes]) -> bool:
    """Check per-entry stages, public totals and variant hierarchy together.

    The accepted path index is already screened by the *caller* ZIP gate.
    Nothing is authenticated here; True means only a single fixture scope
    has internally consistent observations and counters.
    """
    if (type(vetted_zip_paths) is not frozenset or
            len(vetted_zip_paths) > MAX_CONTROLLED_O3D_ENTRIES or
            any(type(path) is not str or not path or
                (not path.isascii()) or path != path.lower() for path in vetted_zip_paths)):
        refuse()
    if (type(stage_paths) is not dict or set(stage_paths) != set(STAGES) or
            type(entry_states) is not dict or
            type(public_counts) is not dict or
            set(public_counts) != set(O3D_EVIDENCE_STATES) or
            type(linked_variants) is not dict or
            set(linked_variants) != set(LINKS)):
        refuse()

    o3d_entries = frozenset(
        path for path in vetted_zip_paths if path.endswith(".o3d"))
    if set(entry_states) != set(o3d_entries):
        refuse()
    if (type(archive_digest) is not bytes or len(archive_digest) != 32 or
            type(entry_digests) is not dict or
            type(entry_receipts) is not dict or
            set(entry_digests) != set(o3d_entries) or
            set(entry_receipts) != set(o3d_entries)):
        refuse()
    for path in o3d_entries:
        if (type(entry_digests[path]) is not bytes or len(entry_digests[path]) != 32
                or type(entry_receipts[path]) is not bytes
                or len(entry_receipts[path]) != 32):
            refuse()
        if (entry_receipts[path] != make_synthetic_entry_receipt(
                archive_digest, path, entry_digests[path])):
            refuse()
    if any(type(state) is not str or state not in DEPTH
           for state in entry_states.values()):
        # The M15 contradiction state must never become a published report.
        refuse()
    if any(type(count) is not int or count < 0
           for count in public_counts.values()):
        refuse()
    totals = {name: 0 for name in O3D_EVIDENCE_STATES}
    for state in entry_states.values():
        totals[state] += 1
    if totals != public_counts:
        refuse()

    for paths in stage_paths.values():
        if (type(paths) is not frozenset or
                not paths.issubset(o3d_entries)):
            refuse()

    for name, paths in linked_variants.items():
        if type(paths) is not frozenset:
            refuse()
        # A linked variant is a package-local prefix of a vetted ZIP entry;
        # this checks provenance to the same accepted ZIP index, NOT a game.
        if any(type(variant) is not str or
               not variant.startswith("vehicles/") or
               len(variant.split("/")) != 2 or
               not any(path.startswith(variant + "/")
                       for path in vetted_zip_paths)
               for variant in paths):
            refuse()

    preceding = "header"
    for current in ("vertex", "triangle", "material", "matrix", "bone"):
        if not stage_paths[current].issubset(stage_paths[preceding]):
            refuse()
        preceding = current
    if (not stage_paths["optionalBoneAbsent"].issubset(stage_paths["matrix"]) or
            stage_paths["bone"] & stage_paths["optionalBoneAbsent"]):
        refuse()

    for path, state in entry_states.items():
        depth = DEPTH[state]
        for index, stage in enumerate(STAGES[:5]):
            if (path in stage_paths[stage]) != (depth >= index):
                refuse()
        if (path in stage_paths["bone"]) != (state == "boundedBoneLayoutObserved"):
            refuse()
        if ((path in stage_paths["optionalBoneAbsent"]) !=
                (state == "matrixWithOptionalBonesAbsent")):
            refuse()

    if not linked_variants["mesh"].issubset(linked_variants["linked"]):
        refuse()
    preceding = "mesh"
    for current in ("header", "vertex", "triangle", "material", "matrix", "bone"):
        if not linked_variants[current].issubset(linked_variants[preceding]):
            refuse()
        preceding = current
    if not linked_variants["optionalBoneAbsent"].issubset(linked_variants["matrix"]):
        refuse()
    return True
