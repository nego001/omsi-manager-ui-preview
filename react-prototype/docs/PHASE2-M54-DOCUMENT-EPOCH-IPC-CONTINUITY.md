# M54 — Document epoch revocation for in-flight read-only IPC

## Threat boundary

M53 rejects packaged dev-server renderer substitution. The earlier IPC gate
verified that senderFrame was the main frame at the expected URL before and
after the native folder picker. It did not independently track whether a
**different document had navigated through the same frame and URL** while
the native picker or asynchronous scan was outstanding.

M54 adds an opaque per-window **document epoch** stored in a main-only WeakMap.
The IPC handler samples it before showing the native dialog and checks it
again after the dialog and after inspection using the existing senderAuthorized
checks. It cannot be supplied by renderer JavaScript.

## Revocation events

- Electron `did-start-navigation`: a full main-frame document navigation
  invalidates the sampled epoch, including reload-to-the-same-URL;
  `isSameDocument` SPA/hash changes and subframe navigations are ignored.
- Missing/malformed event details conservatively invalidate.
- `did-navigate`: defense-in-depth fallback invalidation.
- `render-process-gone` and `destroyed`: permanently revoke the guard.
- The original origin/frame checks remain mandatory. An invalidated inspection
  returns a generic origin error; no selected folder path or raw evidence is
  returned to the renderer.

The navigation listeners are installed **before initial window load**; an
initial document load rotates the epoch before the first eligible inspection.

## Verification and limitations

Ten offline adversarial tests run inside `npm run test:security`, covering
cross-document epoch invalidation, old-proof replay, forged tokens, process
death, SPA navigation, malformed events, and main-process guard ordering.

This is a **main-process-only defensive continuity check**, not a promise that
a filesystem scan that has already begun can be cancelled. It does not
guarantee atomic path containment, resolve same-path ABA races, prove Chromium
sandbox isolation or resolve Ubuntu 24.04 native X11 `SIGTRAP`. The existing
strict Ubuntu24 gate and independent administrator A/B/A requirements remain.

No root Electron, sandbox bypass, AppArmor/sysctl mutation, mods installation,
game write, installer, merge, release, or waiver. Stack on Draft M53, retain
Draft status and issue #4 as the release blocker.
