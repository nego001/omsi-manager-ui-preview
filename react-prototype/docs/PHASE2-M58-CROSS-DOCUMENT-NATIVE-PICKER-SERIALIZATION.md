# M58 — One native picker across a real renderer reload

## Concrete concurrency question

M57 verifies actual Electron hash navigation and full renderer reload while
a synthetic native picker is outstanding. M58 explicitly checks the **gap
between reload and release** of the old dialog: the replacement document must
not open a second native folder picker concurrently.

## Regression exercise

The existing sandbox-enabled Electron IPC E2E test now counts calls to a
deferred fake `dialog.showOpenDialog`. One request is issued by the original
document. Playwright performs a **real page reload** while that first picker
is unresolved. Once the new document is ready, a second
`window.omsiPreview.inspectGame('omsi')` request must return the existing
fixed `Já existe uma inspeção em andamento.` error without another picker
call. The call count must remain exactly one.

The test then releases the old pending picker, checks that the former
renderer execution context did not masquerade as a new one, and confirms
a new explicit cancellation works after the prior request's `finally`
cleans the one-at-a-time lock.

The user-selected folder is always a synthetic fixture; the actual picker is
mocked. No new UI capability or path is exposed and file sentinel bytes are
unchanged. Real reload is exercised on Electron with
`chromiumSandbox: true`.

## Limitations / security gating

This demonstrates serialized picker admission through the real IPC path,
not that the OS-native picker can be force-closed, nor that a started file scan
can be canceled, nor a complete sandbox attestation. A stuck OS dialog may
still block new inspections until the original request settles, by design
rather than opening unsafe parallel dialogs.

Ubuntu24 strict X11 `SIGTRAP` remains blocking and requires an approved
administrator-owned disposable-VM A/B/A with independent sandbox evidence
and rollback. No `--no-sandbox`, root Electron, host policy modifications,
real game mods, merge, release, installer, or waiver. Stacked on Draft M57.
