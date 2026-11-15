"""M11: bounded triangle-index HINTS on CI-generated O3D fixture bytes ONLY.

Only a tiny first vertex section followed immediately by a first triangle
section is recognized. Rejecting a fixture pattern does not reject a valid
OMSI model. No user-supplied files, rendering, format verification, or geometry
semantics. Return fixed categories; never echo indices, bytes or names.
"""
from __future__ import annotations

from controlled_o3d_vertex_hints import (
    MAX_O3D_SAMPLE, VERTEX_STRIDE_BYTES, classify_bounded_o3d_vertex_section
)

MAX_O3D_TRIANGLE_SAMPLE = 4096
MAX_SYNTHETIC_TRIANGLES = 64
O3D_TRIANGLE_HINT_CLASSES = (
    "plausibleBoundedTriangleIndices",
    "vertexSectionUnconfirmed",
    "missingTriangleSection",
    "unsupportedTriangleSection",
    "truncatedTriangleCount",
    "zeroTriangleCount",
    "countOverBudget",
    "truncatedTrianglePayload",
    "outOfRangeVertexIndex",
)


def classify_bounded_o3d_triangle_indices(sample: bytes, file_size: int) -> str:
    """Inspect synthetic structural indices, not real O3D mesh correctness."""
    if (type(sample) is not bytes or type(file_size) is not int or
            file_size < 0 or len(sample) > MAX_O3D_TRIANGLE_SAMPLE or
            len(sample) > file_size):
        raise ValueError("CONTROLLED_O3D_TRIANGLE_REFUSED")
    if (classify_bounded_o3d_vertex_section(
            sample[:MAX_O3D_SAMPLE], file_size) != "plausibleBoundedVertexPayload"):
        return "vertexSectionUnconfirmed"

    version = sample[2]
    header_size = 3 if version == 1 else 4 if version == 3 else 8
    count_size = 2 if version == 1 else 4
    vertex_count_start = header_size + 1
    vertex_count = int.from_bytes(
        sample[vertex_count_start:vertex_count_start + count_size],
        "little", signed=False)
    triangle_tag = vertex_count_start + count_size + vertex_count * VERTEX_STRIDE_BYTES

    if len(sample) == triangle_tag:
        return "missingTriangleSection"
    if sample[triangle_tag] != 0x49:
        return "unsupportedTriangleSection"

    count_start = triangle_tag + 1
    count_end = count_start + count_size
    if len(sample) < count_end:
        return "truncatedTriangleCount"
    triangle_count = int.from_bytes(sample[count_start:count_end], "little")
    if triangle_count == 0:
        return "zeroTriangleCount"
    if triangle_count > MAX_SYNTHETIC_TRIANGLES:
        return "countOverBudget"

    # This is a deliberately narrow dialect: flag bit 0 selects 32-bit
    # indices for observed versions >= 3; older v1 uses 16-bit indices.
    index_size = 4 if version >= 3 and sample[3] & 1 else 2
    triangle_stride = index_size * 3 + 2  # material slot is u16; not checked
    payload_end = count_end + triangle_count * triangle_stride
    if len(sample) < payload_end:
        return "truncatedTrianglePayload"

    for triangle in range(triangle_count):
        offset = count_end + triangle * triangle_stride
        for corner in range(3):
            start = offset + corner * index_size
            vertex_index = int.from_bytes(sample[start:start + index_size], "little")
            if vertex_index >= vertex_count:
                return "outOfRangeVertexIndex"
    return "plausibleBoundedTriangleIndices"
