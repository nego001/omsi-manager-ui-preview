# M56 — Live Electron IPC regression for M54 navigation epochs

## Evidence gap

M54 added a main-process-only document epoch and unit-level adversarial tests,
but did not exercise the behavior across a genuine Electron renderer→IPC
request while the native picker Promise is outstanding.

M56 adds three narrowly labeled scenarios to the **existing** desktop IPC
smoke (`scripts/desktop-inspection-e2e.mjs`). It still launches the Electron
app with `chromiumSandbox: true` and works only on synthetic fixture data.

## Exact test behavior

For each scenario, main-process code replaces only `dialog.showOpenDialog`
with a **deferred synthetic Promise**. The actual renderer calls
`window.omsiPreview.inspectGame('omsi')` through the real preload and IPC.
After verifying the picker was reached, test code emits a documented synthetic
webContents navigation notification, then resolves the fake picker as canceled.

1. `did-start-navigation` with `isMainFrame:true` and
   `isSameDocument:false`: the old document epoch is invalidated and IPC
   returns only the fixed unauthorized-origin error.
2. Main-frame same-document change (`isSameDocument:true`): authorization
   stays valid and an explicit cancellation returns `status:'cancelled'`.
3. `did-navigate` fallback: the old epoch is invalidated and IPC again
   returns the fixed unauthorized-origin error.

A normal cancel afterward checks that `activeInspections` was released,
and the existing tests verify that mod operations remain disabled.

## No overclaim

These are **synthetic navigation notifications in the real Electron process**,
not authentic reloads, compositor events, native dialog responses, or evidence
that a file scan is cancelable after it has begun. The existing origin and
read-only scan constraints remain in effect. No tests disable sandboxing.

Ubuntu 24.04 strict native X11 `SIGTRAP` remains the mandatory failed gate,
requiring an administrator-approved disposable VM A/B/A, independent sandbox
verification, and rollback. No merge, release, policy changes, root Electron,
real mod installation or waiver. M56 is stacked on Draft M55 and stays Draft.
