"""M14: bounded optional O3D 0x54 bone-weight HINTS on CI-created ZIP bytes.

This is NOT a complete OMSI parser or renderer. No real files, no filesystem,
no transformation of geometry, no external references and no private output.
Every result is a fixed label. The M13 matrix hint must pass first.
"""
from __future__ import annotations

import math
import struct

from controlled_o3d_matrix_hints import (
    MATRIX_BYTES, MAX_O3D_MATRIX_SAMPLE, classify_bounded_o3d_matrix_section
)
from controlled_o3d_material_hints import MATERIAL_FLOAT_BLOCK_BYTES
from controlled_o3d_vertex_hints import VERTEX_STRIDE_BYTES

MAX_O3D_BONE_SAMPLE = MAX_O3D_MATRIX_SAMPLE  # Reuse the existing 8192-byte buffer
MAX_SYNTHETIC_BONES = 4
MAX_SYNTHETIC_WEIGHTS_PER_BONE = 8
MAX_SYNTHETIC_BONE_NAME_BYTES = 48

O3D_BONE_HINT_CLASSES = (
    "plausibleBoundedBoneWeights",
    "matrixSectionUnconfirmed",
    "optionalBoneSectionAbsent",
    "boneSectionOutsideSampleBudget",
    "unsupportedTrailingSection",
    "truncatedBoneCount",
    "zeroBoneCount",
    "boneCountOverBudget",
    "missingBoneNameLength",
    "emptyBoneName",
    "boneNameOverBudget",
    "truncatedBoneName",
    "truncatedWeightCount",
    "zeroWeightCount",
    "weightCountOverBudget",
    "truncatedWeightPayload",
    "outOfRangeBoneVertexIndex",
    "nonFiniteBoneWeight",
)


def classify_bounded_o3d_bone_weights(sample: bytes, file_size: int) -> str:
    """Only narrow byte layout, opaque names, and local vertex-index bounds."""
    if (type(sample) is not bytes or type(file_size) is not int or
            file_size < 0 or len(sample) > MAX_O3D_BONE_SAMPLE or
            len(sample) > file_size):
        raise ValueError("CONTROLLED_O3D_BONE_REFUSED")

    if (classify_bounded_o3d_matrix_section(sample, file_size)
            != "plausibleBoundedMatrixLayout"):
        return "matrixSectionUnconfirmed"

    version = sample[2]
    header_size = 3 if version == 1 else 4 if version == 3 else 8
    count_width = 2 if version == 1 else 4
    vertex_count_at = header_size + 1
    vertex_count = int.from_bytes(
        sample[vertex_count_at:vertex_count_at + count_width], "little")
    triangle_tag = (vertex_count_at + count_width
                    + vertex_count * VERTEX_STRIDE_BYTES)
    triangle_count_at = triangle_tag + 1
    triangle_count = int.from_bytes(
        sample[triangle_count_at:triangle_count_at + count_width], "little")
    index_width = 4 if version >= 3 and sample[3] & 1 else 2
    triangle_stride = 3 * index_width + 2
    material_tag = triangle_count_at + count_width + triangle_count * triangle_stride
    material_count_at = material_tag + 1
    material_count = int.from_bytes(
        sample[material_count_at:material_count_at + 2], "little")

    pos = material_count_at + 2
    # M12/M13 already established the bounded synthetic material layout.
    for _ in range(material_count):
        length_pos = pos + MATERIAL_FLOAT_BLOCK_BYTES
        pos = length_pos + 1 + sample[length_pos]
    # M13 already established that pos points at a 0x79 tag + 64-byte matrix.
    pos += 1 + MATRIX_BYTES

    if pos == len(sample):
        return ("optionalBoneSectionAbsent" if file_size == len(sample)
                else "boneSectionOutsideSampleBudget")
    if sample[pos] != 0x54:
        return "unsupportedTrailingSection"
    pos += 1
    if len(sample) < pos + 2:
        return "truncatedBoneCount"
    bone_count = int.from_bytes(sample[pos:pos + 2], "little")
    pos += 2
    if bone_count == 0:
        return "zeroBoneCount"
    if bone_count > MAX_SYNTHETIC_BONES:
        return "boneCountOverBudget"

    weight_stride = index_width + 4  # local vertex index + opaque f32 weight
    for _ in range(bone_count):
        if pos >= len(sample):
            return "missingBoneNameLength"
        name_bytes = sample[pos]
        pos += 1
        if name_bytes == 0:
            return "emptyBoneName"
        if name_bytes > MAX_SYNTHETIC_BONE_NAME_BYTES:
            return "boneNameOverBudget"
        if len(sample) < pos + name_bytes:
            return "truncatedBoneName"
        pos += name_bytes  # never decode or return the name

        if len(sample) < pos + 2:
            return "truncatedWeightCount"
        weight_count = int.from_bytes(sample[pos:pos + 2], "little")
        pos += 2
        if weight_count == 0:
            return "zeroWeightCount"
        if weight_count > MAX_SYNTHETIC_WEIGHTS_PER_BONE:
            return "weightCountOverBudget"
        if len(sample) < pos + weight_count * weight_stride:
            return "truncatedWeightPayload"

        for _ in range(weight_count):
            vertex_index = int.from_bytes(
                sample[pos:pos + index_width], "little")
            weight = struct.unpack_from("<f", sample, pos + index_width)[0]
            if vertex_index >= vertex_count:
                return "outOfRangeBoneVertexIndex"
            if not math.isfinite(weight):
                return "nonFiniteBoneWeight"
            pos += weight_stride

    # Weights are NOT normalized or semantically validated; trailing bytes
    # and later sections are deliberately ignored.
    return "plausibleBoundedBoneWeights"
