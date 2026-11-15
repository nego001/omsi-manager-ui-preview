"""Conservative game HINTS from bounded, CI-generated in-memory ZIP bytes.

Wraps the preexisting controlled ZIP reader. It never opens real files or
extracts content, and it never authenticates game identity or compatibility.
The result contains fixed labels and aggregate numbers only.
"""
from __future__ import annotations

from controlled_zip_reader import examine_controlled_zip_bytes


def assess_controlled_zip_game_hints(payload: bytes) -> dict:
    """Classify TEST-FIXTURE patterns, not an actual game's mod format.

    Two marker-bearing bus/cfg entries in one Vehicles/<variant> folder
    require a bounded [model] reference from the BUS to the CFG, AND the
    linked CFG must cite an O3D fixture entry with [mesh] in the same variant,
    before producing an OMSI *fixture candidate*. SiiNunit-like markers under def/
    remain ambiguous between ETS2 and ATS. All source bytes are supplied
    directly in memory; the existing ZIP reader enforces entry limits,
    path rules, compression policy, CRC and size accounting.
    """
    report = examine_controlled_zip_bytes(payload)
    hints = report["fixtureGameHints"]
    paired = hints["omsiPairedVehicleFolders"]
    linked = hints["omsiLinkedVehicleFolders"]
    mesh_linked = hints["omsiMeshLinkedVehicleFolders"]
    missing_mesh = hints["omsiLinkedWithoutMeshFolders"]
    unlinked = hints["omsiUnlinkedPairedFolders"]
    bus = hints["omsiBusMarkerFolders"]
    cfg = hints["omsiCfgMarkerFolders"]
    truck = hints["truckSiiDefinitionMarkers"]

    if (linked or paired) and truck:
        assessment = "mixed-markers-ambiguous"
    elif mesh_linked:
        assessment = "omsi-fixture-candidate"
    elif linked:
        assessment = "omsi-model-mesh-unconfirmed"
    elif truck:
        assessment = "ets2-ats-shared-format-ambiguous"
    elif paired:
        assessment = "unlinked-omsi-fixture-markers"
    elif bus or cfg:
        assessment = "insufficient-omsi-fixture-evidence"
    else:
        assessment = "no-recognizable-fixture-evidence"

    return {
        "source": "ci-generated-zip-bytes",
        "stage": "controlled-fixture-game-hints",
        "assessment": assessment,
        "omsiPairedVehicleFolderCount": paired,
        "omsiLinkedVehicleFolderCount": linked,
        "omsiMeshLinkedVehicleFolderCount": mesh_linked,
        "omsiPlausibleO3dHeaderLinkedVehicleFolderCount": hints["omsiPlausibleO3dHeaderLinkedVehicleFolders"],
        "omsiMeshLinkedWithoutPlausibleHeaderFolderCount": hints["omsiMeshLinkedWithoutPlausibleHeaderFolders"],
        "o3dHeaderHintCounts": report["o3dHeaderHintCounts"],
        "omsiBoundedVertexHintLinkedVehicleFolderCount": hints["omsiBoundedVertexHintLinkedVehicleFolders"],
        "omsiMeshLinkedWithoutBoundedVertexHintFolderCount": hints["omsiMeshLinkedWithoutBoundedVertexHintFolders"],
        "o3dVertexSectionHintCounts": report["o3dVertexSectionHintCounts"],
        "omsiBoundedTriangleHintLinkedVehicleFolderCount": hints["omsiBoundedTriangleHintLinkedVehicleFolders"],
        "omsiMeshLinkedWithoutBoundedTriangleHintFolderCount": hints["omsiMeshLinkedWithoutBoundedTriangleHintFolders"],
        "o3dTriangleIndexHintCounts": report["o3dTriangleIndexHintCounts"],
        "omsiBoundedMaterialHintLinkedVehicleFolderCount": hints["omsiBoundedMaterialHintLinkedVehicleFolders"],
        "omsiMeshLinkedWithoutBoundedMaterialHintFolderCount": hints["omsiMeshLinkedWithoutBoundedMaterialHintFolders"],
        "o3dMaterialReferenceHintCounts": report["o3dMaterialReferenceHintCounts"],
        "meshFormatVerified": False,
        "omsiLinkedWithoutMeshFolderCount": missing_mesh,
        "omsiUnlinkedPairedFolderCount": unlinked,
        "omsiBusMarkerFolderCount": bus,
        "omsiCfgMarkerFolderCount": cfg,
        "truckSiiMarkerCount": truck,
        "zipBytesReadInMemory": True,
        "zipCrcChecked": report["zipHeadersAndCrcRead"],
        "evidenceAuthenticated": False,
        "gameRecognized": False,
        "realModInspected": False,
        "compatibilityVerified": False,
        "installationEnabled": False,
        "realGameFilesTouched": False,
    }
