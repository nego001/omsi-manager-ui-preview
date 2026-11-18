# Phase 2 / M47 — actual Ubuntu 22.04 packaged renderer kernel reference (not sandbox certification)

## Real observability improvement

M46 [CI #44227024514](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/44227024514) completed **21/22 jobs**, with the **mandatory strict Ubuntu 24.04 native X11 gate still failing**. Its A/B/A intake remained `awaiting-admin-authorization-and-external-aba-records`; no administrator pilot has been performed.

M47 makes useful, new runtime evidence available **without changing any host policy**. The existing `portable-linux-smoke.mjs` already launches the actual unsigned CI-packaged Electron binary under Ubuntu 22.04, with an Xvfb X11 display and Chromium sandbox requested. For each of three fresh launches — main, an Xvfb GNOME label, and an Xvfb KDE label — it uses Electron main-process metrics to identify the renderer, reads that renderer's `/proc` security values via `electron-renderer-kernel-evidence.mjs`, requires `Seccomp: 2` and `NoNewPrivs: 1`, verifies the renderer PID did not change across observation, and checks UI capabilities remain read-only. Missing process identity, missing restrictions, malformed fields or forbidden switches **fail the build**.

M47 now retains **only categorical summaries** for the three renderer samples:
- `renderer-kernel-restrictions-observed`, `seccompMode=filter`, `noNewPrivs=enabled`;
- a fixed enum for how Electron process identity was checked;
- a fixed enum for the AppArmor label mode, **never the label path or profile name**;
- explicit `false` for renderer sandbox certification, user namespace isolation, policy verification, actual GNOME/KDE sessions, Ubuntu 24.04 native gate, release, installation and merge.

No PID, argv, real filesystem paths, raw `/proc` status, user name, stderr, mod, game or screenshot is written to this evidence artifact.

## Workflow

- The Ubuntu 22.04 build job runs **15 M47 adversarial contracts** and its existing packaged Linux GUI smoke. Only after all three real renderer restrictions are verified does it emit `test-results/m47/renderer-reference.json`.
- The job uploads `m47-renderer-ubuntu22-sanitized` with seven-day retention.
- The existing read-only cross-runner comparator downloads this fixed artifact, validates all fields, and reconciles it with the **M46 external A/B/A not-performed** report. It emits `ubuntu22-xvfb-kernel-reference-only-ubuntu24-unverified`, never a sandbox certification.
- The mandatory Ubuntu 24.04 `native_auto_x11` job remains unchanged and strict. M47 does not test renderer confinement on Ubuntu 24.04 because the application never gets to the verified window stage there.

## Safety boundaries

Three Xvfb labels represent three CI launch scenarios **not** genuine GNOME/KDE desktop sessions. `Seccomp=2` and `NoNewPrivs=1` in a renderer are useful kernel-level observations but **do not independently prove the Chromium sandbox is complete**, that its security boundaries are sufficient, or that the AppArmor profile caused `SIGTRAP`. No externally authorized A/B/A or rollback was executed. The existing Ubuntu 24.04 blocker and issue #4 remain open. No policy/sysctl modification, `--no-sandbox`, root Electron, mod installation, merge or release.
