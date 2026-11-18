# M50 — Same-process continuity across real Electron renderer probes (Ubuntu 22.04)

## Starting point

[M49 CI #44234576896](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/44234576896) completed **21/22**. The **mandatory strict native Ubuntu 24.04 X11 job** remains the sole failure. Three real Ubuntu22 packaged Electron renderers had read-only M47 kernel restrictions, M48 namespace relationships and M49 capability / tracer / filter observations. None of those diagnostics independently certifies a complete Chromium sandbox, AppArmor's causal role in Ubuntu24 SIGTRAP, or a real administrator A/B/A pilot.

## Integrity gap closed

Checking the renderers' process IDs before and after sampling is useful, but a reused numeric PID is still possible. M50 adds a separate *kernel process birth marker* to the existing **three real packaged Linux Electron GUI launches** (main, GNOME-labelled Xvfb, KDE-labelled Xvfb):

1. Resolve the Electron main PID and renderer PID from the already trusted main-process / Electron metric path.
2. **Before M47–M49 probes**, read the **unmodified** kernel `/proc/<pid>/stat` field 22 (`starttime`) for *both* the Electron main process and the selected renderer. The parser handles parentheses and spaces within the process command name, verifies the expected PID and exact field position, and refuses malformed or incomplete snapshots.
3. Keep the PID + birth tokens **only in a private in-memory WeakMap** associated with an opaque, non-serializable-by-value and **one-time** token. If the process vanishes, the data cannot be read, or any start time differs at the end, the packaged GUI smoke **fails**.
4. **After M47–M49 probes**, read both process `stat` files again; reject changed birth markers or a different PID; consume the token so it cannot be reused.
5. Publish **only** `mainKernelBirthMarkerMatched=true` and `rendererKernelBirthMarkerMatched=true` per scenario, together with explicit false flags for independent security certification. **Never publish** start tick values, PIDs, process commands, raw `/proc` snapshots or real filesystem paths.

The three samples remain *packaged Electron Xvfb labels only*, **not real GNOME/KDE desktops**. This is a sampled continuity property (two points in time), not immutable proof against all PID reuse or a cryptographically authenticated process identity.

## Automation and controls

- `auto-x11-m50-process-continuity.mjs` provides the Linux kernel read-only probes, strict validation, and a same-CI M46/M47/M48/M49/M50 comparator.
- `auto-x11-m50-process-continuity.test.mjs` has **18 adversarial tests** including malformed stat field boundaries, fake PIDs, zero or misleading start times, odd parenthesized command names, forged approvals, mismatched sample labels and a fabricated proof object.
- `portable-linux-smoke.mjs` captures a birth marker *before* and confirms it *after* the existing M47/M48/M49 probes for each real packaged renderer and its Electron main process.
- `.github/workflows/react-prototype.yml` runs tests in build and read-only comparison, uploads `m50-ubuntu22-process-continuity-sanitized` with 7-day retention, and validates its exact name in the downstream comparison. Missing or malformed evidence fails closed.

## Non-claims and outstanding blockers

A matched birth marker sampled twice cannot absolutely rule out PID reuse between reads or demonstrate Chromium's entire sandbox, renderer confinement, or app-specific AppArmor causality. Ubuntu24 never reaches the real owned-window renderer inspection in the strict job. No external authorized A/B/A, administrator approval, disposable VM verification, rollback or independent package byte attestation has occurred.

There are no host security policy writes, privileged / root Electron operations, sandbox bypass flags, `unshare`, `ptrace`, real OMSI mods, installation, merge or release. Issue #4 remains open and all existing Draft PRs remain blocked.
