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

- 11 packaged shell wrapper and E2E separation regression tests use a byte-for-byte copy of the **actually generated** wrapper and a fake sibling executable in a disposable directory. They check default and Wayland launch commands, numerous unsafe or unknown arguments, empty arguments, inherited runtime options and nonexecution of the sibling binary on refusal.
- Native auto-launcher regression adds an inherited-variable refusal test and checks the diagnostic remains callable.
- The CI still executes the full packaged Linux GUI smoke and the **mandatory unchanged Ubuntu 24.04 strict native X11 gate**.

## Explicit limits

The official shell wrapper no longer supports passing arbitrary command-line options, a deliberate security behavior change. Direct invocation of the Electron binary remains outside this official wrapper's control. The observation that Ubuntu24 has restricted unprivileged user namespaces and repeated SIGTRAP before opening an owned window is **not** independent proof of the root cause. The separately authorized disposable-VM A/B/A and independent Chromium sandbox assessment are still necessary.

No policy/sysctl writes, sandbox bypass, privileged Electron, real OMSI mod reads, installation, merge or release. PR remains Draft; issue #4 stays open.

## Playwright test harness separation (CI fix)

An initial M51 CI attempt [#44322725893](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/44322725893) confirmed the official shell/native guard tests passed but the packaged Playwright GUI smoke failed at the Electron driver handshake. The driver needs its own runtime instrumentation, while the official wrappers now deliberately refuse those inherited runtime options.

The corrective commit changes **only** the Playwright E2E harness to invoke the **same packaged Electron ELF directly** (with its existing `chromiumSandbox:true` requirement). The real native Auto launcher remains covered separately by native launcher tests **and** the strict two-runner native X11 gate. The generated shell script remains tested with a synthetic adjacent executable, and does **not** regain argument forwarding or an exception for CI. The first explicit Weston Wayland smoke supplies the same controlled ozone Wayland flag in the E2E harness; the automatic Wayland and simulated GNOME/KDE scenarios preserve their no-extra-argument checks.

An additional regression test enforces that all five Playwright package launch sites select the direct ELF and still require Chromium sandbox. This is test-harness compatibility, **not** a weakening of the official user launchers, a sandbox bypass or evidence that Ubuntu 24.04 is fixed.

## Bounded CI context API read retry — independent failure isolation

In [workflow run #44324199650](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/44324199650), the actual packaged shell, native ELF, Chromium sandbox-enabled Playwright, X11 on Ubuntu22 and Wayland/Weston tests passed. Besides the unchanged mandatory Ubuntu24 strict failure, the independent GitHub read-only context audit refused twice during API retrieval with a duration consistent with its existing nine-second HTTP timeout. The generic privacy-safe refusal does not identify a specific endpoint, so the root cause of the API failure is not authenticated.

Only that audit's **read-only GitHub API fetch** function now retries an unsuccessful request up to **three total attempts** with the same fixed endpoint and token. It does not retry semantic validation or change the default deny behavior: unexpected JSON, invalid job labels, unavailable required evidence, incomplete reference runs, or a failed Ubuntu24 native gate **remain blocked**. Failed requests never print URLs, API data, auth tokens or user paths.

Three additional offline unit tests verify exactly two transient retries, hard refusal after the third API error, and zero retry for an invalid semantic response. No branch rules, required-check settings, merge or release state is changed.

This API reliability change is not a waiver of the mandatory Ubuntu24 strict test, and no successful audit response is considered security certification.
