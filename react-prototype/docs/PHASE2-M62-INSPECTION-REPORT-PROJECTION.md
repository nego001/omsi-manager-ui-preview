# M62 — Explicit metadata-inspection report projection

## Boundary

The main-process inspection executor already checked a few fields, but
returned `{...report,provenance}`. An unexpected property on a scanner
summary, or a nested value inside its groups/assessment/notices, could
therefore cross the privileged main-to-renderer IPC boundary.

M62 replaces that object spread with a bounded **explicit data-transfer
object**. It reconstructs all values the renderer needs and discards
unknown properties instead of forwarding the scanner's raw report.

## Validation

- The top-level report and assessment/groups are ordinary data objects;
  required fields must be own data descriptors, never inherited accessors.
- Only approved game/group IDs are accepted; group names and notice strings
  come from fixed, local game metadata, never untrusted injected strings.
- Counters are safe non-negative integers bounded by 2,000. All output
  counters and privilege flags are defined by the projector.
- Folder labels are at most 100 chars; embedded slashes, backslashes,
  controls and NUL are refused rather than sent to the renderer.
- Assessment is reconstructed with `compatibilityVerified:false` and
  `installationVerified:false`. The main-process provenance remains
  wholly separate and permanently read-only.
- Optional fields in legacy internal test stubs receive conservative
  defaults. Production scanner outputs already contain complete fields.

Six offline adversarial tests cover nested secrets, getters never read,
invalid numeric and privilege fields, forged folder names, executor IPC
output and stable UI notice labels.

## Limits

This does not turn pathname-based enumeration into an atomic handle-based
scan or defeat all TOCTOU races. The native adapter is still disconnected in
production. No file content is opened to validate mods; no installation or
recovery is enabled. No Ubuntu24 AppArmor/X11 compatibility claim follows.

M62 stacks on Draft M61. Issue #4 strict Ubuntu24 SIGTRAP remains mandatory,
requiring administrator-owned disposable-VM A/B/A, real renderer sandbox
attestation and rollback. No sandbox bypass, root Electron, host changes,
release, merge, game writes or CI waiver.
