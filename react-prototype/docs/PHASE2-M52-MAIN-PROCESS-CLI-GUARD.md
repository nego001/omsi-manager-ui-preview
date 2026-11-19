# M52 — Main-process startup refusal for unsafe Electron switches

## Threat boundary

M51 hardened the **official** Linux shell and native launchers. A user can still execute the packaged Electron binary directly, including passing Chromium command-line switches. M52 adds a last *application-owned*, fail-closed guard **at the very start of Electron main-process JavaScript**, before any inspection grant, IPC handler, BrowserWindow or navigation is configured.

This cannot stop Electron from starting or executing native initialization before the JavaScript runs. It is **not a replacement** for Chromium or kernel sandboxing and does not protect users who bypass the application main script. It does not claim to block every conceivable Electron launch flag.

## Implementation

The pure CommonJS helper `electron/launch-argument-guard.cjs` refuses ten specifically recognized unsafe switches, whether supplied as `--switch` or `--switch=value`, including:

- sandbox bypass/reduction: `no-sandbox`, `disable-setuid-sandbox`, `disable-seccomp-filter-sandbox`, `disable-gpu-sandbox`;
- renderer/web security reduction: `disable-web-security`, `allow-running-insecure-content`, `ignore-certificate-errors`, `disable-site-isolation-trials`;
- unsafe process topology: `single-process` and `no-zygote`.

It checks both raw `process.argv.slice(1)` and the normalized Electron `app.commandLine.hasSwitch` API. If either reports an unsafe switch, malformed argument, or an unusable switch API, startup is refused with exit code 3 and a **fixed non-sensitive message**. No untrusted argument, private path or environment variable is echoed.

The guard does **not** use environment-variable rejection in Electron main JS: the packaged Playwright test driver uses an internal Node/Electron handshake, and environment restrictions on the distributed **official launchers** remain separately tested under M51. It also does not reject every unknown Electron flag or interfere with internally needed safe Playwright flags.

## Verification

`electron/launch-argument-guard.test.cjs` provides ten offline adversarial tests. They cover arguments with different casings and values, normalized Electron switches, arbitrary arguments, malformed inputs, fixed errors, strict window/IPC ordering and unchanged renderer webPreferences. The CI already runs `npm run test:security` before browser and package tests, and keeps the full real packaged Electron smoke, native Ubuntu22/Ubuntu24 strict gates and existing M47–M50 checks.

The tests **never launch a real Electron instance with sandbox bypass flags**. Such launches would be inappropriate to classify as security qualification. M52 can only demonstrate early main-JavaScript refusal for recognized inputs and no corresponding real GUI creation.

## Unresolved Ubuntu24 gate

Current repeatability evidence shows Ubuntu 22.04 Xvfb native windows while Ubuntu 24.04 exits `SIGTRAP` before a mapped/owned window under the required strict sandbox. A host policy difference is observed, but causality is unproven. No administrator-authorized disposable-VM A/B/A, app-specific AppArmor policy check, independent rollback or full Chromium renderer confinement attestation has occurred.

No AppArmor/sysctl writes, `--no-sandbox` test launches, root Electron, mod operations, installer, merge, release or sandbox waiver. The M52 PR remains Draft and issue #4 remains blocking.
