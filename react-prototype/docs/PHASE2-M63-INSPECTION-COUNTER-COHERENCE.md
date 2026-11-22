# M63 — Consistent metadata counters at the renderer IPC boundary

## Why
M62 introduced a bounded, path-free DTO for inspection reports. It checked
each counter separately but did not require their relationships to be
consistent. A malformed scanner or injected adapter could report a missing
folder with symlink skips, or claim more classified entries than the total.

## Rule
The same main-owned DTO projection now requires:
- `directories + files + others` must never exceed `count`.
- When the scanner supplies **all three** breakdown counters (the production
  scanner does), their sum **must equal** `count`. Legacy test doubles with
  only some optional fields retain conservative defaults.
- `packageCandidates` cannot exceed `files`. Non-`mods` OMSI groups
  must always report zero candidates because the scanner only classifies
  package extensions for ETS2/ATS mod folders.
- A group marked `found:false` cannot have nonzero `count`, nonzero
  `linksSkipped`, or `limited:true`.
- Symlink skips are **separate** from `count`, and a present directory
  with only symlinks can legitimately be `count:0, limited:true`.

Four adversarial tests cover contradictions and explicitly preserve the
legitimate all-symlink edge case.

## Security and release limits
This is output contract hardening, not a new directory scanning algorithm,
atomic path containment proof, a runtime sandbox attestation, permission
for real mod operations or an Ubuntu24 workaround. Native strict Ubuntu24
`SIGTRAP` remains mandatory issue #4 and requires authorized disposable
VM A/B/A with independent confinement evidence and rollback.

No host-policy changes, sandbox bypass, root Electron, merge or release.
M63 stacks on Draft M62.
