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
    require a bounded [model] reference from the BUS to the CFG before
    producing an OMSI *fixture candidate*. SiiNunit-like markers under def/
    remain ambiguous between ETS2 and ATS. All source bytes are supplied
    directly in memory; the existing ZIP reader enforces entry limits,
    path rules, compression policy, CRC and size accounting.
    """
    report = examine_controlled_zip_bytes(payload)
    hints = report["fixtureGameHints"]
    paired = hints["omsiPairedVehicleFolders"]
    linked = hints["omsiLinkedVehicleFolders"]
    unlinked = hints["omsiUnlinkedPairedFolders"]
    bus = hints["omsiBusMarkerFolders"]
    cfg = hints["omsiCfgMarkerFolders"]
    truck = hints["truckSiiDefinitionMarkers"]

    if linked and truck:
        assessment = "mixed-markers-ambiguous"
    elif linked:
        assessment = "omsi-fixture-candidate"
    elif paired and truck:
        assessment = "mixed-markers-ambiguous"
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
