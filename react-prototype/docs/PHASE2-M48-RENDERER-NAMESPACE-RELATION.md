# Phase 2 / M48 — read-only renderer vs main-process namespace relations

## Why

[M47 CI #44229847220](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/44229847220) completed **21/22 jobs**. In its *actual packaged Linux Electron smoke* on Ubuntu 22.04, three renderers were identified and checked against their kernel `Seccomp=2` and `NoNewPrivs=1` settings; all three passed. The mandatory Ubuntu 24.04 strict native X11 check still failed. M46 confirmed that **no authorized external A/B/A pilot has occurred**.

M48 adds a different, **limited** kernel observation: compare the `user` and `mnt` namespace symlinks in `/proc/<main-pid>/ns/` and `/proc/<renderer-pid>/ns/` on the *same live packaged Electron launch*. The renderer identity still comes from Electron's trusted main-process metrics and is checked for PID stability. The process pair is never stored.

## What the tool does

For each packaged Ubuntu22 Xvfb launch — main, GNOME-labelled, KDE-labelled — the diagnostic computes two relations using **readlink only**:
- `userNamespace`: `same`, `different`, or `unavailable`;
- `mountNamespace`: `same`, `different`, or `unavailable`.

The raw inode identifiers from `user:[...]` / `mnt:[...]` are immediately discarded. Invalid targets, missing access and disappearing processes become **`unavailable`**, not a positive proof. No sudo/root, ptrace, `unshare`, namespace creation, sandbox flags, policy installation, sysctl change, kernel change or sensitive file operations are needed.

The new `auto-x11-m48-namespace-relation.mjs` module validates strictly sanitized categorical reports. In CI, the existing Ubuntu22 build's packaged GUI smoke creates `m48/renderer-namespace-relations.json` using exactly the same three launches as M47. A seven-day `m48-namespace-ubuntu22-sanitized` artifact is uploaded. The existing read-only comparator downloads it, verifies M46, M47 and M48 schemas and labels, and logs only counts of relations and explicit **false** security/approval flags.

**17 adversarial tests** cover forged renderer identity, incomplete pairs, bogus sysfs/link target strings, malformed fields, incorrect roles/runners, tampered counts, spoofed approval, and root/non-CI refusal.

## Interpretation and limits

- A **different** namespace is a limited process topology observation; it does **not** prove complete Chromium sandbox isolation or its security effectiveness.
- The **same** namespace is not automatic evidence of a sandbox vulnerability; Chromium has other isolation controls. Lack of access becomes `unavailable` rather than a guess.
- This compares with the Electron **main process only**; it neither traces all children nor independently authenticates package signatures/host identities.
- GNOME/KDE are **synthetic Xvfb environment labels**, not actual desktop sessions.
- Ubuntu 24.04 remains **unobserved** at the renderer namespace stage while its real native X11 gate fails. Its AppArmor/SIGTRAP cause cannot be claimed from these Ubuntu22 observations.
- No external A/B/A pilot has occurred. Its explicit administrator consent, disposable VM, rollback, independent renderer confinement, genuine desktop and strict Ubuntu24 native approval remain required before any release or merge.

## Files

- `scripts/auto-x11-m48-namespace-relation.mjs`
- `scripts/auto-x11-m48-namespace-relation.test.mjs`
- `scripts/portable-linux-smoke.mjs` (same real packaged Electron run, read-only namespace links)
- `.github/workflows/react-prototype.yml` (tests, sanitized artifact and strict comparison)

The mandatory strict Ubuntu 24.04 job, security policy and previous Draft PRs are unchanged. No real mods or installation are accessed.
