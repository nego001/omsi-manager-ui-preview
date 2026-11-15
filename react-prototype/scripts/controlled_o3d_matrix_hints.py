"""M13: bounded O3D matrix-section LAYOUT hints for synthetic CI ZIP bytes.

Not a general OMSI decoder. Checks a narrow 0x17 -> 0x49 -> 0x26 -> 0x79
sequence after prior bounded classifiers. Does not apply transforms, inspect
geometry, authenticate assets, or open real files. All output labels are fixed.
"""
from __future__ import annotations

import math
import struct

from controlled_o3d_material_hints import (
    MATERIAL_FLOAT_BLOCK_BYTES, MAX_O3D_MATERIAL_SAMPLE,
    classify_bounded_o3d_material_references
)
from controlled_o3d_vertex_hints import VERTEX_STRIDE_BYTES

MAX_O3D_MATRIX_SAMPLE = MAX_O3D_MATERIAL_SAMPLE
MATRIX_FLOAT_COUNT = 16
MATRIX_BYTES = MATRIX_FLOAT_COUNT * 4
O3D_MATRIX_HINT_CLASSES = (
    "plausibleBoundedMatrixLayout",
    "materialSectionUnconfirmed",
    "extendedFlagsUnconfirmed",
    "missingMatrixSection",
    "unsupportedMatrixSection",
    "truncatedMatrixPayload",
    "nonFiniteMatrixElements",
)


def classify_bounded_o3d_matrix_section(sample: bytes, file_size: int) -> str:
    """Classify a 16x-float32 synthetic matrix layout, never its meaning."""
    if (type(sample) is not bytes or type(file_size) is not int or
            file_size < 0 or len(sample) > MAX_O3D_MATRIX_SAMPLE or
            len(sample) > file_size):
        raise ValueError("CONTROLLED_O3D_MATRIX_REFUSED")
    if (classify_bounded_o3d_material_references(sample, file_size)
            != "plausibleBoundedMaterialReferences"):
        return "materialSectionUnconfirmed"

    version = sample[2]
    # Observed version 7 / flags 3 may contain protected/junk content.
    # Keep those cases explicitly unconfirmed rather than decoding as a
    # conventional matrix; this restriction applies ONLY to test hints.
    if version >= 3 and (sample[3] & ~1):
        return "extendedFlagsUnconfirmed"

    header_size = 3 if version == 1 else 4 if version == 3 else 8
    count_size = 2 if version == 1 else 4
    vertex_count_at = header_size + 1
    vertex_count = int.from_bytes(
        sample[vertex_count_at:vertex_count_at + count_size], "little")
    triangle_tag = vertex_count_at + count_size + vertex_count * VERTEX_STRIDE_BYTES
    triangle_count_at = triangle_tag + 1
    triangle_count = int.from_bytes(
        sample[triangle_count_at:triangle_count_at + count_size], "little")
    index_width = 4 if version >= 3 and sample[3] & 1 else 2
    triangle_stride = index_width * 3 + 2
    material_tag = triangle_count_at + count_size + triangle_count * triangle_stride
    material_count_at = material_tag + 1
    material_count = int.from_bytes(
        sample[material_count_at:material_count_at + 2], "little")

    position = material_count_at + 2
    # Previous M12 classification already checked the whole table and
    # name-length bounds. Do not decode or publish the opaque name bytes.
    for _ in range(material_count):
        name_length_at = position + MATERIAL_FLOAT_BLOCK_BYTES
        position = name_length_at + 1 + sample[name_length_at]

    if len(sample) == position:
        return "missingMatrixSection"
    if sample[position] != 0x79:
        return "unsupportedMatrixSection"
    start = position + 1
    if len(sample) < start + MATRIX_BYTES:
        return "truncatedMatrixPayload"

    values = struct.unpack_from("<16f", sample, start)
    if not all(math.isfinite(value) for value in values):
        return "nonFiniteMatrixElements"

    # Finite floats do not prove valid affine transform or renderability.
    return "plausibleBoundedMatrixLayout"
