# M57 — Real renderer hash navigation and reload recovery during pending picker

## Why this test matters

M56 exercised the real preload-to-main IPC but simulated Electron
navigation notifications. Those tests are useful, yet cannot establish that
actual renderer navigation behaves as expected.

M57 extends the **same synthetic-folder Electron IPC smoke** with two
genuine browser-side navigation paths. The native picker remains a deferred
main-process test double: no host portal is invoked and no real game directory
is inspected.

## Evidence

1. **Actual same-document hash change**: a renderer starts the real
   `window.omsiPreview.inspectGame('omsi')` IPC, the native picker Promise is
   paused, and renderer JS changes `window.location.hash`.
   A real `did-navigate-in-page` event must be observed by the main process.
   When the fake picker is canceled, the old same-document IPC may still
   return `status:'cancelled'` rather than being falsely invalidated.
2. **Actual browser reload**: a fresh IPC begins and the native picker waits.
   Playwright initiates a real `page.reload()`, waits for the new document,
   then releases the old pending picker. The original evaluation must reject
   due to destroyed execution context, not be misrepresented as a successful
   reply to the replacement renderer. A **new** IPC then accepts explicit
   cancellation, verifying cleanup of the old one-dialog lock.
3. A synthetic file-content sentinel remains unchanged after both paths.

The app keeps `chromiumSandbox:true`; it does not enable install/uninstall
or any other write operation.

## Limits

This is genuine Electron renderer navigation with a **mock native picker**,
not a real native dialog/portal, not a certification of Chromium sandbox
isolation, not evidence of canceling an already-started filesystem scan, and
not a solution for Ubuntu24 strict X11 `SIGTRAP`.

The mandatory Ubuntu24 gate remains and still needs an administrator-approved
disposable-VM A/B/A plus independent sandbox evidence and rollback. Keep M57
Draft, stacked on M56. No merge, release, global host security changes,
root Electron, sandbox bypass flags, or modification of real OMSI files.
