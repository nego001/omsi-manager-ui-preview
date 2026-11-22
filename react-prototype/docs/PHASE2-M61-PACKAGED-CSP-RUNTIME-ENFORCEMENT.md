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
3. Attempts to `fetch()` a harmless `data:text/plain` URL. That must be
   denied by `connect-src 'none'`, without any network request.

Any deviation fails the existing mandatory Windows/Linux packaged smoke.
Three offline unit/contract tests also reject false-positive reports and
verify integration in both packaged test paths.

**Correction after the first Windows CI run:** the original probe used
`Function('return 37')` inside Playwright's privileged `evaluate()`.
That call **executed** even though inline script injection and the
forbidden fetch were both blocked and the exact CSP was present.
Playwright/CDP evaluation is not a trustworthy ordinary page-script
context for measuring `unsafe-eval`. Treating its result as CSP
enforcement proof is invalid, so the runtime probe was removed, not
silenced or marked passing. The packaged CSP still explicitly omits
`unsafe-eval`, and the M60 unit/build tests verify that textual policy.

The live tests now assert **only two browser-managed behaviors**: inline
DOM script rejection and blocked `fetch`, alongside the exact meta
policy check. A future independent non-DevTools page-script harness would
be required to claim dynamic code compilation is blocked at runtime.
No actual attacker-origin injection is attempted.

## Limits

The image allowlist still permits third-party Steam cover requests.
This test does not prove that all injection risks are eliminated, certify
the kernel sandbox or resolve native X11 on Ubuntu 24.04. All samples are
synthetic and no real games or mods are touched.

The M61 PR remains Draft and stacks on M60. Strict Ubuntu24 `SIGTRAP`
stays the release blocker pending administrator-authorized disposable-VM
A/B/A and independently verified renderer confinement. No sandbox bypass,
root Electron, host policy changes, installer, merge, release or waiver.
