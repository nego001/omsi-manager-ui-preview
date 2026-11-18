# M49 — actual packaged Electron renderer privilege census (read-only, Ubuntu 22.04)

## Existing evidence and remaining blocker

[M48 CI #44232707441](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/44232707441) completed **21/22 jobs**. The required native Ubuntu 24.04 strict-X11 job remains the only failure. Ubuntu 22.04 packaged Electron under Xvfb exposed three real renderers with `Seccomp=2`, `NoNewPrivs=1`, and three different `user` namespaces from the Electron main process. Those observations **do not** independently certify complete Chromium sandbox security. M46 confirms no external approved A/B/A pilot or rollback.

## New read-only kernel measurements

M49 reuses the **same three real packaged Ubuntu 22.04 Electron GUI launches** (main, GNOME-labelled Xvfb, KDE-labelled Xvfb). Electron itself identifies the renderer process using process metrics; the existing smoke test checks PID stability across probes. The new `probeM49RendererPrivilegeStatus` reads that renderer's **read-only** `/proc/<pid>/status` and immediately classifies:

- `CapEff` — effective Linux capabilities: `none` or `present`;
- `CapPrm` — permitted Linux capabilities: `none` or `present`;
- `CapAmb` — ambient Linux capabilities: `none` or `present`;
- `TracerPid` — `not-traced` or `tracer-present`;
- `Seccomp_filters` — `positive` or `zero`.

The parser additionally requires one consistent `Seccomp: 2` and `NoNewPrivs: 1` for the same live renderer snapshot. A positive capability mask, tracer, no seccomp filters, unreadable/malformed field, mismatched label or missing renderer **fails closed**. The test does not perform `ptrace`, attach debuggers, read mod files, or alter host policy.

Only five **fixed-category labels** per scenario are emitted. No raw capability mask, `/proc` status, PID, process command line, AppArmor path, credentials, directory, inode or stderr is exported. The machine-readable `m49-renderer-ubuntu22-sanitized` artifact is retained seven days.

## Chain of custody and required checks

- The existing build job runs **17 adversarial M49 tests** before the real GUI smoke.
- The packaged Linux GUI test emits the M47, M48 and M49 reports from the same three Electron launches, after verifying renderer PID stability. The CI upload requires the M49 report to exist.
- The downstream read-only M40–M49 comparator reruns the M49 adversarial tests, downloads the exact named artifact, validates M46/M47/M48/M49 categorical schemas, and logs only a limited summary. It **never** updates, disables or waives the Ubuntu 24.04 strict-X11 job.
- As with earlier same-run reports, this is **not independent signed-build or external-host attestation**.

## Explicit non-claims

All capability masks being zero and the presence of one or more seccomp filters means only that **these kernel properties were observed in the selected renderer processes**. It does *not* demonstrate all Chromium sandbox restrictions, independently certify namespace isolation, prove AppArmor caused Ubuntu24 `SIGTRAP`, or prove a working GUI on a real GNOME/KDE session. No renderer proof is currently possible on Ubuntu 24.04 while the native gate does not open a verified window.

The approved administrator A/B/A pilot in a disposable Ubuntu 24.04 VM, exact package identity, app-specific policy scope, independently verified rollback, genuine desktop tests, independent sandbox assessment and passing native Ubuntu24 job all remain open. No `--no-sandbox`, root Electron, AppArmor/sysctl writes, unshare, privilege escalation, installation, merge or release.
