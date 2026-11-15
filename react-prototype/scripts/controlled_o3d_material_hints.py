"""M12: bounded material-section and triangle-material reference HINTS.

For synthetic CI-generated O3D bytes in memory only. It DOES NOT parse or
authenticate OMSI meshes, render geometry, validate floats or inspect real mods.
Recognizes a narrow first 0x17 -> 0x49 -> 0x26 sequence with strict budgets.
Every result is a constant classification with no paths or payload content.
"""
from __future__ import annotations

from controlled_o3d_triangle_hints import (
    MAX_O3D_TRIANGLE_SAMPLE, classify_bounded_o3d_triangle_indices
)
from controlled_o3d_vertex_hints import VERTEX_STRIDE_BYTES

MAX_O3D_MATERIAL_SAMPLE = 8192
MAX_SYNTHETIC_MATERIALS = 16
MAX_SYNTHETIC_MATERIAL_NAME_BYTES = 48
MATERIAL_FLOAT_BLOCK_BYTES = 11 * 4
O3D_MATERIAL_HINT_CLASSES = (
    "plausibleBoundedMaterialReferences",
    "triangleSectionUnconfirmed",
    "missingMaterialSection",
    "unsupportedMaterialSection",
    "truncatedMaterialCount",
    "zeroMaterialCount",
    "countOverBudget",
    "truncatedMaterialFloats",
    "missingMaterialNameLength",
    "emptyMaterialName",
    "nameOverBudget",
    "truncatedMaterialName",
    "outOfRangeTriangleMaterial",
)


def classify_bounded_o3d_material_references(sample: bytes, file_size: int) -> str:
    """Check only layout/bounds of a tiny synthetic material table."""
    if (type(sample) is not bytes or type(file_size) is not int or
            file_size < 0 or len(sample) > MAX_O3D_MATERIAL_SAMPLE or
            len(sample) > file_size):
        raise ValueError("CONTROLLED_O3D_MATERIAL_REFUSED")

    if (classify_bounded_o3d_triangle_indices(
            sample[:MAX_O3D_TRIANGLE_SAMPLE], file_size)
            != "plausibleBoundedTriangleIndices"):
        return "triangleSectionUnconfirmed"

    version = sample[2]
    header_size = 3 if version == 1 else 4 if version == 3 else 8
    count_size = 2 if version == 1 else 4
    vertex_count_start = header_size + 1
    vertex_count = int.from_bytes(
        sample[vertex_count_start:vertex_count_start + count_size], "little")
    triangle_tag = (vertex_count_start + count_size
                    + vertex_count * VERTEX_STRIDE_BYTES)

    triangle_count_start = triangle_tag + 1
    triangle_count = int.from_bytes(
        sample[triangle_count_start:triangle_count_start + count_size],
        "little")
    triangle_data = triangle_count_start + count_size
    index_size = 4 if version >= 3 and sample[3] & 1 else 2
    triangle_stride = index_size * 3 + 2
    material_tag = triangle_data + triangle_count * triangle_stride

    if len(sample) == material_tag:
        return "missingMaterialSection"
    if sample[material_tag] != 0x26:
        return "unsupportedMaterialSection"
    material_count_at = material_tag + 1
    material_data_at = material_count_at + 2  # material count is u16
    if len(sample) < material_data_at:
        return "truncatedMaterialCount"

    material_count = int.from_bytes(
        sample[material_count_at:material_data_at], "little")
    if material_count == 0:
        return "zeroMaterialCount"
    if material_count > MAX_SYNTHETIC_MATERIALS:
        return "countOverBudget"

    position = material_data_at
    for _ in range(material_count):
        if len(sample) < position + MATERIAL_FLOAT_BLOCK_BYTES:
            return "truncatedMaterialFloats"
        position += MATERIAL_FLOAT_BLOCK_BYTES
        if position >= len(sample):
            return "missingMaterialNameLength"
        name_size = sample[position]
        position += 1
        if name_size == 0:
            return "emptyMaterialName"
        if name_size > MAX_SYNTHETIC_MATERIAL_NAME_BYTES:
            return "nameOverBudget"
        if len(sample) < position + name_size:
            return "truncatedMaterialName"
        position += name_size

    # The material slot in each synthetic triangle is a u16. Correlation is
    # wholly local, with no access to external files or lookup of textures.
    for triangle in range(triangle_count):
        start = triangle_data + triangle * triangle_stride + 3 * index_size
        material_index = int.from_bytes(sample[start:start + 2], "little")
        if material_index >= material_count:
            return "outOfRangeTriangleMaterial"

    return "plausibleBoundedMaterialReferences"
