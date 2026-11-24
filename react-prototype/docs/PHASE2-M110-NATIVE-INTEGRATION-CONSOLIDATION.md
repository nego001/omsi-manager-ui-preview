# M110 — native integration consolidation (2026-11-24)

**Decision: METADATA_ONLY_PREVIEW / CONTENT_READ_BLOCKED / RELEASE_BLOCKED.**
Documentation-only review pinned to M109 4ad648340eb83d2107c713de75c773f4ae178d8b (PR #116). No permission, production code, workflow, branch policy or release changes. This is not independent approval.

## Observed CI, snapshot at review time

| Revision | Exact run | Linux build/security | Browser and existing IPC | Windows portable | Base observation |
|---|---|---|---|---|---|
| M105 corrected db5f5ba | [45407370950](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45407370950) | pass | browser running, IPC pending | pass | pass |
| M106 corrected a59a361 | [45407392322](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45407392322) | pass | browser running, IPC pending | pass | fail |
| M107 dceb7bc | [45407544757](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45407544757) | pass | pass (existing directory IPC) | pass | pass |
| M108 d73ea03 | [45407933412](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45407933412) | pass | browser running, IPC pending | pass | pass |
| M109 4ad6483 | [45408220884](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45408220884) | pass | browser running, new file IPC pending | pass | pass |

M109 Windows job 138494602866: security 335 passed, six skipped, zero failed of 341 declared. M101 archive check verified 19 Electron modules, lab directories and Electron tests excluded, static imports checked. This unsigned package audit is not a native sandbox certification. No overall workflow pass asserted. Job 138492211275 logs were not downloadable at review time; step status was available, so no exact browser count is asserted. M105's initial responsive failure (expected four selects, actual five) corrected in both affected branches; M107 descendant browser pass observed, direct corrected-run completion still pending.

M106 base-policy job 138491975126 refused; event base ab5f8f1394fd50ccd86ac755fe431f96bd7a4067 differs from current M105 correction db5f5bac226686a523ab7e26792c54cdba24c68e. Plausible stale event mismatch, not proven sole cause. M109 job 138494602447 observed matching base/head, draft, unprotected base flag, zero reported active rules, no base CODEOWNERS, no independent approval/merge eligibility. Preserve policy gate; no approval inferred.

Ubuntu24 strict historical-failure read-only job success does NOT mean strict native gate success. M100 evidence remains applicable: SIGTRAP on Auto and direct Electron controls with namespace denial correlated, no proven AppArmor causality. New strict native runs not yet validated. No host policy modification, bypass or waiver.

## Production boundary at M109

- M108 actual Electron openFile selection uses fixed bus/ovh/cfg filters, shared sender one-flight, current main frame/origin/document epoch, cancellation and a metadata-only result. No renderer pathname accepted; no durable selection token.
- New module performs repeated realpath/lstat on selected file and parent. It does not open file content, enumerate dependencies or authenticate an OS file handle. Extension and bounded size are hints only. Metadata UI remains separate from M105/M107 fictitious diagnostics; browser selection disabled.
- M102–M104 and M106 remain in scripts/; M101 excludes them from distributed runtime. Existing capability readGameFiles must remain false until a separate reviewed change.
- M109 E2E uses actual sandboxed Electron renderer/preload/main with mocked native dialog responses; instrumented fixture-specific fs/promises calls, shared guard, epoch notification and real reload. Does not test actual portals, OS-native picker behavior or all I/O paths. New IPC test result pending.
- No repair, installation, deletion, backup/restore or automatic action authorized.

## Gaps blocking content admission

1. M106 uses pathname-based metadata observations, not a retained native identity. M102 O_NOFOLLOW where available guards the final component only; it does not protect all parent traversal, intermediate replacement, reparse point semantics or ABA. M104 enumerates directories by path and checks identity before/after, not an atomic snapshot. Do not promote these directly as production containment.
2. M106 wall-clock expiry and cooperative AbortSignal are not an enforced OS read deadline; document change suppresses output but cannot force an already-awaited kernel call to stop. Review monotonic expiry, resource cleanup, bounded operations and cancellation at each boundary.
3. Existing folder grant does not authorize file content. M108 metadata selection is not reusable consent. Future scope must explicitly state selected configuration content read and separately explain limited dependency metadata observations in the selected parent; no raw bytes/paths forwarded, no directory-wide content access.
4. Validate Linux and Windows independently: secure handle-relative/no-link or equivalent platform implementation, regular-file identity and hardlink policy, Windows reparse points/case behavior, changed parents and file replacement, special files and bounds. A missing platform primitive must be a refusal, not a weaker fallback.
5. Existing M105 and M106 projection validators duplicate report contract checks; align/test them before any runtime bridge. M108 UI currently validates rendered metadata fields, not an exact shape. A strict projection and clear separation of real metadata from fictitious diagnostic are required.
6. Native picker/portal behavior on genuine GNOME/KDE and Hyprland desktop still needs independent evidence, separate from Xvfb and mocked dialog checks. Package signing/provenance and independent branch review remain release gates.

## Next steps proposed

M111: isolated native file-handle identity and containment proof-of-concept on Linux, using only self-created fixtures. Investigate dirfd-relative open with no traversal and no symlink following; no new production permission. Include deterministic parent replacement, symlink/special-file, cancellation and metadata/byte budget tests. Do not claim an implementation before CI. M112: Windows equivalent with reparse-aware verified handle-relative semantics; unsupported platforms refuse. M113: unify report schema and explicit native content consent contract; M114: gated read-only content integration only after independent review of platform evidence and exact CI. M115: end-to-end real-content read-only validation with disposable OMSI-shaped fixtures and separately authorized desktop testing. Continue to block all writes and release. These are proposed work items, not completed capabilities.
