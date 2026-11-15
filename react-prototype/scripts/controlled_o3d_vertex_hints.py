"""M10: bounded FIRST vertex-section hint on CI-generated synthetic O3D bytes.

This is NOT a complete O3D decoder or a real-mod validator. No geometry,
indices, normals, materials or later sections are parsed. Every result is a
fixed safe label. Input should be a small prefix collected by the ZIP gate.
"""
from __future__ import annotations

from controlled_o3d_header_hints import classify_o3d_header_prefix

MAX_O3D_SAMPLE = 1_100
MAX_SYNTHETIC_VERTICES = 32
VERTEX_STRIDE_BYTES = 8 * 4  # 8 float32 slots, never interpreted as geometry
O3D_VERTEX_HINT_CLASSES = (
    "plausibleBoundedVertexPayload",
    "headerUnconfirmed",
    "missingFirstSection",
    "unsupportedFirstSection",
    "truncatedVertexCount",
    "zeroVertexCount",
    "countOverBudget",
    "truncatedVertexPayload",
)


def classify_bounded_o3d_vertex_section(sample: bytes, file_size: int) -> str:
    """Classify byte LAYOUT only, not syntax or semantics of a true O3D."""
    if (type(sample) is not bytes or type(file_size) is not int or
            file_size < 0 or len(sample) > MAX_O3D_SAMPLE or
            len(sample) > file_size):
        raise ValueError("CONTROLLED_O3D_SECTION_REFUSED")

    if classify_o3d_header_prefix(sample[:8]) != "plausiblePrefix":
        return "headerUnconfirmed"

    version = sample[2]
    header_size = 3 if version == 1 else 4 if version == 3 else 8
    if len(sample) == header_size:
        return "missingFirstSection"
    if sample[header_size] != 0x17:
        return "unsupportedFirstSection"

    count_size = 2 if version == 1 else 4
    count_start = header_size + 1
    count_end = count_start + count_size
    if len(sample) < count_end:
        return "truncatedVertexCount"
    count = int.from_bytes(sample[count_start:count_end], "little", signed=False)
    if count == 0:
        return "zeroVertexCount"
    if count > MAX_SYNTHETIC_VERTICES:
        return "countOverBudget"

    expected_end = count_end + count * VERTEX_STRIDE_BYTES
    return ("plausibleBoundedVertexPayload" if len(sample) >= expected_end
            else "truncatedVertexPayload")
