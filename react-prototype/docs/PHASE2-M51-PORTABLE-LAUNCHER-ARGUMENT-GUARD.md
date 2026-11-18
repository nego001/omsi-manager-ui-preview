# M51 — Hardening official Linux portable launchers

## Concrete gap fixed

The official ELF auto launcher already rejected arbitrary command-line options. However the distributed portable shell launcher previously forwarded all arguments to the packaged Electron binary. That meant an unsafe Chromium option could be passed using the official shell entrypoint.

M51 closes this inconsistency in **both official launchers**; this is a product hardening fix, not a claim that Ubuntu 24.04 sandbox is fixed. Users with direct access to the Electron executable can still invoke it with their own arguments: this change does **not** prevent or certify direct-binary launches.

## Implementation

- The generated OMSI-Manager-Preview.sh requires **zero arguments**, including no empty arguments, and never forwards positional arguments. Failure occurs with exit code 3 and a fixed non-sensitive message before running the packaged binary.
- The script rejects any presence (even an empty value) of inherited ELECTRON_RUN_AS_NODE or NODE_OPTIONS, which could alter Electron or Node runtime behavior; raw values are never echoed.
- The opt-in OMSI_MANAGER_NATIVE_WAYLAND=1 remains supported and adds **only** an internal ozone-platform=wayland switch. Default behavior adds no Electron switches.
- The compiled OMSI-Manager-Auto C launcher retains its no-arguments behavior, root refusal and strict-sandbox defaults. The normal launch path also refuses those two inherited runtime variables. Its explicitly requested, read-only --diagnose-sandbox mode continues to work without launching Electron.

## Test coverage

- 10 new packaged shell wrapper regression tests use a byte-for-byte copy of the **actually generated** wrapper and a fake sibling executable in a disposable directory. They check default and Wayland launch commands, numerous unsafe or unknown arguments, empty arguments, inherited runtime options and nonexecution of the sibling binary on refusal.
- Native auto-launcher regression adds an inherited-variable refusal test and checks the diagnostic remains callable.
- The CI still executes the full packaged Linux GUI smoke and the **mandatory unchanged Ubuntu 24.04 strict native X11 gate**.

## Explicit limits

The official shell wrapper no longer supports passing arbitrary command-line options, a deliberate security behavior change. Direct invocation of the Electron binary remains outside this official wrapper's control. The observation that Ubuntu24 has restricted unprivileged user namespaces and repeated SIGTRAP before opening an owned window is **not** independent proof of the root cause. The separately authorized disposable-VM A/B/A and independent Chromium sandbox assessment are still necessary.

No policy/sysctl writes, sandbox bypass, privileged Electron, real OMSI mod reads, installation, merge or release. PR remains Draft; issue #4 stays open.
