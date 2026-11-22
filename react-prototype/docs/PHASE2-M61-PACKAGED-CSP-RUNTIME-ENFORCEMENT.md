# M61 — Packaged Electron CSP enforced in a live renderer

## Why M60's evidence wasn't enough

M60 inserted and verified an exact policy in `dist/index.html`. A static
tag does not alone demonstrate that the browser **enforces** CSP in a real
distributed Electron process. M61 tests enforcement directly.

## Runtime experiment

Both existing **packaged** Windows and Linux Playwright smoke scripts
now call the same test helper **after** a genuine sandbox-enabled Electron
renderer has loaded and rendered the welcome heading. The test:

1. Requires the exact CSP string from the renderer DOM's policy meta tag.
2. Appends an inert synthetic inline `script` that would set a marker if
   executed. The marker **must not** be set.
3. Uses a synthetic `Function('return 37')` expression; it must be blocked
   by the absence of `unsafe-eval`.
4. Attempts to `fetch()` a harmless `data:text/plain` URL. That must be
   denied by `connect-src 'none'`, without any network request.

Any deviation fails the existing mandatory Windows/Linux packaged smoke.
Three offline unit/contract tests also reject false-positive reports and
verify integration in both packaged test paths.

Playwright's `evaluate()` by itself is privileged instrumentation; no
claim is made that CSP blocks DevTools evaluation. We test actual DOM
script execution, Function compilation and resource fetch performed *inside*
the renderer. No actual injection from an attacker is attempted.

## Limits

The image allowlist still permits third-party Steam cover requests.
This test does not prove that all injection risks are eliminated, certify
the kernel sandbox or resolve native X11 on Ubuntu 24.04. All samples are
synthetic and no real games or mods are touched.

The M61 PR remains Draft and stacks on M60. Strict Ubuntu24 `SIGTRAP`
stays the release blocker pending administrator-authorized disposable-VM
A/B/A and independently verified renderer confinement. No sandbox bypass,
root Electron, host policy changes, installer, merge, release or waiver.
