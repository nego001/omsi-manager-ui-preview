"""M15: consistent per-O3D evidence labels for synthetic in-memory ZIP fixtures.

No filesystem, network, raw paths, payloads or real mod data. The sealed
input vocabulary is fixed by M9-M14 classifiers. Do not use this coordinator
to decide real game, authenticity, compatibility, extraction or installation.
"""
from __future__ import annotations

from controlled_o3d_header_hints import O3D_HEADER_CLASSES
from controlled_o3d_vertex_hints import O3D_VERTEX_HINT_CLASSES
from controlled_o3d_triangle_hints import O3D_TRIANGLE_HINT_CLASSES
from controlled_o3d_material_hints import O3D_MATERIAL_HINT_CLASSES
from controlled_o3d_matrix_hints import O3D_MATRIX_HINT_CLASSES
from controlled_o3d_bone_hints import O3D_BONE_HINT_CLASSES

O3D_EVIDENCE_STATES = (
    "noSupportedHeader",
    "headerOnly",
    "vertexLayoutOnly",
    "triangleIndexOnly",
    "materialLayoutOnly",
    "matrixWithOptionalBonesAbsent",
    "matrixWithBoneSectionOutsideBudget",
    "matrixWithBonesUnconfirmed",
    "boundedBoneLayoutObserved",
    "inconsistentSyntheticStageEvidence",
)

CONTRADICTION_STATE = "inconsistentSyntheticStageEvidence"


def classify_fixture_o3d_evidence(
        header: str, vertex: str, triangle: str, material: str,
        matrix: str, bone: str) -> str:
    """Return one fixed label. Never combine observations from two O3Ds.

    Consistency rules are intentionally strict and do not represent all
    valid OMSI section orders or all O3D versions.
    """
    fields = (
        (header, O3D_HEADER_CLASSES),
        (vertex, O3D_VERTEX_HINT_CLASSES),
        (triangle, O3D_TRIANGLE_HINT_CLASSES),
        (material, O3D_MATERIAL_HINT_CLASSES),
        (matrix, O3D_MATRIX_HINT_CLASSES),
        (bone, O3D_BONE_HINT_CLASSES),
    )
    if any(type(value) is not str or value not in choices
           for value, choices in fields):
        raise ValueError("CONTROLLED_O3D_EVIDENCE_REFUSED")

    checks = (
        (header == "plausiblePrefix",
         vertex != "headerUnconfirmed"),
        (vertex == "plausibleBoundedVertexPayload",
         triangle != "vertexSectionUnconfirmed"),
        (triangle == "plausibleBoundedTriangleIndices",
         material != "triangleSectionUnconfirmed"),
        (material == "plausibleBoundedMaterialReferences",
         matrix != "materialSectionUnconfirmed"),
        (matrix == "plausibleBoundedMatrixLayout",
         bone != "matrixSectionUnconfirmed"),
    )
    # The next classifier must acknowledge the previous one, either by
    # analyzing its section or stating that the prior section is unconfirmed.
    if any(previous_passed != next_did_not_downgrade
           for previous_passed, next_did_not_downgrade in checks):
        return CONTRADICTION_STATE

    if bone == "plausibleBoundedBoneWeights":
        return "boundedBoneLayoutObserved"
    if matrix == "plausibleBoundedMatrixLayout":
        if bone == "optionalBoneSectionAbsent":
            return "matrixWithOptionalBonesAbsent"
        if bone == "boneSectionOutsideSampleBudget":
            return "matrixWithBoneSectionOutsideBudget"
        return "matrixWithBonesUnconfirmed"
    if material == "plausibleBoundedMaterialReferences":
        return "materialLayoutOnly"
    if triangle == "plausibleBoundedTriangleIndices":
        return "triangleIndexOnly"
    if vertex == "plausibleBoundedVertexPayload":
        return "vertexLayoutOnly"
    if header == "plausiblePrefix":
        return "headerOnly"
    return "noSupportedHeader"


def empty_evidence_counts() -> dict[str, int]:
    """Fixed aggregation schema; never include a filename as a key."""
    return {name: 0 for name in O3D_EVIDENCE_STATES}
