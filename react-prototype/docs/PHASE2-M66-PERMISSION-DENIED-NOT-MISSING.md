# M66 — Permission denied is not a missing game-content folder

## Finding

`identityAt()` in the existing metadata-only scanner used to reduce
four filesystem error categories to `null`: `ENOENT`, `ENOTDIR`,
`EACCES`, and `EPERM`.

The last two mean **access was refused**, not that the directory is absent.
If a selected root was accessible but a game-content group was protected,
the scanner could report a misleading clean `found:false, count:0` for
that group, or even say there were no known folders.

## Fix

- Only `ENOENT` (missing) and `ENOTDIR` (path component is not a
  directory) still indicate an absent group.
- `EACCES` and `EPERM` now abort the scan rather than producing a
  partial report that incorrectly claims the directory is missing.
- The existing Electron main-process IPC exception handler already
  returns the fixed, path-free error:
  `Não foi possível inspecionar essa pasta.`
  It still never returns raw `fs` errors or selected paths.
- No new filesystem permissions, recursive inspection, content reads,
  mod operations, native adapter or privileged calls were added.
- Four deterministic adversarial tests use injected in-process fake
  `fsApi` denials to avoid dependence on runner privileges. They cover
  initial group `lstat`, direct counters, `opendir`, and preservation of
  true absent / not-a-directory groups.

## Scope / release

This protects interpretation of filesystem errors. It does **not**
establish atomic path containment, prevent ABA/symlink races, or prove
native OS portal/sandbox behavior. The existing mandatory Ubuntu24
native X11 SIGTRAP (issue #4) remains unresolved. No gate waiver,
root Electron, sandbox bypass, host/AppArmor/sysctl changes, real
mod writes, merge, installer or release. M66 stacks on Draft M65.
