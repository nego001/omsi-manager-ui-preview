# Phase 2 / M15 | Synthetic O3D evidence coordinator

**Branch:** feat/controlled-zip-o3d-evidence-coordinator-v1
**Base:** PR #18 / M14, Draft. No merge/release.

## Why this stage exists

M8/M9/M10/M11/M12/M13/M14 returned separate structural measurements.
Independent summary counters could be misread as if one O3D had passed all
stages, even if one file provided the header and a different file provided
the materials or bones. M15 never assembles a *composite model* from those
aggregate totals.

The coordinator is called once **for each actual O3D entry in a synthetic
CI-created ZIP**, with fixed-category results for **that same entry**:
header → vertices → triangles → materials → matrix → optional bones.
The ZIP reader's pre-existing entry/size/CRC checks apply before analysis.

It checks the dependency chain: a later stage cannot report evidence when
its predecessor was unconfirmed. Inconsistent fixed labels return the
constant state **inconsistentSyntheticStageEvidence**, not a fabricated
candidate. The coordinator rejects labels outside the declared schemas
without echoing raw strings or paths.

## Fixed evidence states

- noSupportedHeader
- headerOnly
- vertexLayoutOnly
- triangleIndexOnly
- materialLayoutOnly
- matrixWithOptionalBonesAbsent
- matrixWithBoneSectionOutsideBudget
- matrixWithBonesUnconfirmed
- boundedBoneLayoutObserved
- inconsistentSyntheticStageEvidence

These refer ONLY to the **tiny synthetic format dialect**, not full OMSI
parser results. "boundedBoneLayoutObserved" **does not** certify that an
animation, geometry, material, mod or binary format is real or usable.

**The 0x54 bone section is optional.** A coherent synthetic sample ending
after the M13 matrix reports matrixWithOptionalBonesAbsent, not invalid.
A sample that stops at the existing 8192-byte analysis budget receives a
distinct unknown state. Unexpected/protected versions remain unconfirmed.

Output:
- o3dSyntheticEvidenceStateCounts: a sealed list of category counts over
  individual O3D entries, never over combined or guessed O3Ds.
- omsiOptionalBoneAbsentLinkedVehicleFolderCount: number of vehicle variants
  where the exact BUS-linked CFG references an O3D whose own state is
  matrixWithOptionalBonesAbsent.
- syntheticEvidenceIsRealFormatProof: false, always.

The prior M14 count for real bone-hint links remains separate. Its presence
does not convert a marker into confirmed simulator identity. Even two
different O3Ds within one variant cannot lend one another their evidence:
only exact CFG [mesh] targets and BUS [model] targets are considered.

## Safety and acceptance

- No actual OMSI mods/files, no game filesystem, IPC, network, extraction,
  package installation, deletion, read-write mode or sandbox modification.
- No new byte buffers or expanded limits. The existing M12–M14 O3D prefix
  is max 8192 bytes; archive limits, CRC and path checks remain unchanged.
- Only constant labels and aggregate totals leave the Python reader.
- Existing M8 classification remains unchanged. All output safety booleans
  for real format, source authentication, game recognition, compatibility,
  real mod inspection, and installation stay false.
- CI synthetic tests cover per-entry consistency, contradiction refusal,
  all-stage sample, absent optional bones, cross-file and cross-variant
  attempts, unlinked CFG, SII ambiguity, invalid labels, and privacy.

PR remains Draft, without merge or release. Ubuntu 24.04 X11 sandbox strict
issue #4 continues to block compatibility homologation.

O3D background research:
https://github.com/openOMSI-org/openOMSI/blob/main/docs/FORMATS.md
