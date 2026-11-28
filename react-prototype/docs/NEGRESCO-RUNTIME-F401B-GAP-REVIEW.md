# F4.01b — existing boundary review and native read design

F4 draft PR #171 targets the F3 checkpoint branch, not main. No merge. F4.01a matrices still pending at review time; first observed Core run 45733851830. No new native read implementation until the previous contract is qualified.

## Existing source review
- electron/native-directory-choice.cjs: native picker validates a single absolute selected path and sanitizes errors. This is user selection, not a durable root handle.
- electron/document-epoch-gate.cjs: opaque main-only document proof, aborts on epoch invalidation or revoke. Reuse as consent lifetime constraint, not file identity proof.
- electron/inspection-grant.cjs: one-shot WeakMap ticket, owner/game binding, 15 second age, cancellation checked before and after inspection. Current ticket stores a path, not a verified OS directory handle. Do not extend it into byte-read authority.
- electron/inspection-executor.cjs: directory metadata only; native auxiliary observation explicitly untrusted, production native adapter absent. No atomic containment or ABA proof; no content access authorization.
- electron/omsi-config-selection.cjs: repeated realpath/lstat metadata precheck and size checks, no content open. Repeated path observations do not bind subsequent reads.
- electron/main.cjs: launch guard precedes IPC/window, native selection and document invalidation. Preserve sandbox and existing channels unchanged.
- scripts/temp-native-file-id.test.cjs, temp-native-file-race.test.cjs, temp-native-directory-enum.test.cjs and temp-main-native-directory-backend.test.cjs: Windows disposable test roots/native observations, not production authority; existing tests explicitly disclaim atomic identity/ABA and real mod support.
- native-lab/synthetic-service-boundary.test.cjs: bounded canonical message admission, no OS principal separation or peer authentication proof.

## Proposed native design (not implemented)
Linux: root descriptor selected in trusted main boundary; handle-relative openat2 with RESOLVE_BENEATH, RESOLVE_NO_SYMLINKS, RESOLVE_NO_MAGICLINKS and conservative RESOLVE_NO_XDEV policy, O_RDONLY/O_CLOEXEC and nonblocking admission of candidate handle, fstat regular-file/single-link policy before bounded read. Unsupported kernel/filesystem/flags => deny, no pathname fallback. Reject unsafe special files before content, use same verified descriptor, compare pre/post identity and metadata; acknowledge residual concurrent mutation/ABA limitations until proven. Consider filesystem-specific support and privilege boundary before any real input.
Windows: trusted native root directory handle, per-component relative handle opens (native NT root-directory semantics), reject reparse points on each opened component, reject volume changes and non-regular objects, validate FileIdInfo and file type/link count/size; bounded reads from the same file handle. No Win32 path-string-only fallback, no elevated privileges or PowerShell production dependency. Evaluate sharing restrictions and explicit failure modes.
Both: explicit main-owned consent, handle lifetime tied to document epoch, fail closed on unknown identity, bounded read/deadline, cancellation, cleanup, sanitized output, no modification or execution. Independent isolation and F1 packaged Linux gates remain mandatory.

## Next laboratory acceptance criteria
Use only program-created disposable fixture roots, no user paths. Separate OS-specific cases for nested regular files, symlinks/junctions, parent substitution, file replacement, special files, hardlinks, cross-volume/mount attempts, size and time limits, handle cleanup. Unavailable native tests must be recorded as gaps rather than counted as verified. No claim of actual race-proof containment or real-read authorization from this review.
