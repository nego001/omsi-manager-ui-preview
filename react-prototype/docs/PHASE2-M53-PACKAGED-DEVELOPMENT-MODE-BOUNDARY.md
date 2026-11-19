# M53 — Prevent packaged Electron from loading the dev server

## Real product boundary

Before M53, `OMSI_MANAGER_DEV_PREVIEW=1` alone selected `http://127.0.0.1:4173/`
in `electron/main.cjs`, including in a packaged application. That permits a
separately running local HTTP service to supply the packaged preview's renderer
while the read-only preload/inspection IPC remain exposed. The normal production
renderer must instead load the bundled `dist/index.html`.

## Narrow correction

- Resolve development mode **once** in Electron main JS, from `app.isPackaged`
  and the exact `OMSI_MANAGER_DEV_PREVIEW` value.
- For packaged Electron, `undefined` and `0` load only the bundled file.
  `1`, unknown environment values or malformed package-state inputs are
  refused with status 3 and one fixed, non-sensitive error.
- Unpackaged Electron permits `1` for the intentional local Vite development
  workflow; `0` or unset load bundled files as before.
- Window selection **and** IPC sender-origin checks reuse the same validated
  decision, rather than independently reading a mutable environment variable.
- Seven offline adversarial tests run in the existing `npm run test:security`
  suite, including ordering, fail-closed inputs and message privacy.

## Limits and release gate

This guard only runs after Electron's native startup loads the application main
script. It does not authenticate a local development service, independently
prove sandbox confinement, prevent all OS-level executable tampering, or fix
the mandatory Ubuntu 24.04 strict-sandbox X11 `SIGTRAP`. No app-specific
AppArmor admin pilot or external approved A/B/A rollback has been performed.

No sandbox bypass flags, AppArmor/sysctl change, root Electron, real OMSI mods,
installer, merge, release or suppression of the strict Ubuntu24 gate.
Stacked on Draft PR #57 (M52); M53 must also stay Draft.
