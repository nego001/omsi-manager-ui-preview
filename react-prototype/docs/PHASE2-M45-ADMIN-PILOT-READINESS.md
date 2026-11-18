# M45 — Read-only CI evidence closure for an administrator's Ubuntu 24.04 pilot

## Why M45 exists

M44 [CI #44223238093](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/44223238093) finished with **21/22 jobs successful**. The mandatory native Ubuntu 24.04 strict-X11 job still fails. In this run, Ubuntu 22.04 exposed **3/3** mapped, process-owned direct Electron windows in M43; Ubuntu 24.04 exposed **0/3** mapped windows and **3/3** `SIGTRAP` signals. The same-run M42 unprivileged namespace probe was permitted on Ubuntu 22.04 and permission-denied on Ubuntu 24.04 with the AppArmor user-namespace restriction enabled. M44 categorized one additional Ubuntu 24.04 direct `SIGTRAP` run as a **generic fatal stderr message**, not a specific AppArmor or sandbox denial.

The project already has **synthetic** administrator A/B/A contracts; they do not imply that an administrator or a disposable Ubuntu VM has actually authorized or performed a policy experiment.

## What is new

The `auto-x11-admin-pilot-readiness.mjs` gate consumes **exactly the existing same-workflow, fixed-name sanitized reports** M40, M41, M42, M43 and M44 in the existing cross-runner comparison job. It calls the existing strict comparators again, checks expected relations between the three independent M43 launches, the original M40/M41 witnesses, the namespace categories M42 and the separate stderr observation M44, and creates one small JSON artifact: `m45-operator-readiness-sanitized`.

The favorable result is deliberately named `repeated-host-contrast-for-administrator-review-only`: this means **request human review**, not “ready to apply a profile”. A missing host contrast, missing mapped window, missing `SIGTRAP` repetition, inconsistent/absent stderr, wrong labels, malformed schemas or absent report prevents this recommendation or fails closed. The handoff lists **eight persistent blockers**, including administrator approval, independent host and package identity, narrow policy scope, baseline/pilot/rollback, host restoration, renderer sandbox and the native Ubuntu 24.04 strict gate.

## Hard safety boundary

M45 never loads, creates or changes an AppArmor profile, never edits sysctl, never executes Electron with a disabled sandbox, never runs Electron as root, never opens a real game or mod, and never certifies sandbox confinement, compatibility, installation, merge or release.

A positive CI report **does not** independently authenticate that the downloaded artifacts came from an unmodified GitHub runner, attest the actual package bytes inside the VM, identify an approved VM, prove administrative authorization, prove AppArmor caused the crash, or prove renderer sandbox isolation. A verified sidecar digest is not a signature. Fixed labels GNOME/KDE under Xvfb are not actual GNOME/KDE sessions.

**No policy pilot is executed by GitHub Actions.** Before a separate human-run A/B/A experiment, an authorized administrator must approve a disposable VM and rollback, independently verify the same executable and policy scope, capture clean baseline evidence, apply any chosen app-specific change by their own controlled process, verify both GUI entrypoints and independently inspect renderer confinement, then restore and verify the host. Until then, issue #4 and the strict Ubuntu 24.04 gate remain blocking and all stacked PRs stay Draft.

## Scope of implementation

- `react-prototype/scripts/auto-x11-admin-pilot-readiness.mjs`: strict same-run report handoff; writes only bounded categorical JSON.
- `react-prototype/scripts/auto-x11-admin-pilot-readiness.test.mjs`: 15 synthetic/adversarial cases, including forged host and policy data, partial trials, absent stderr, private fields, fake permissions and offline CLI refusal.
- `.github/workflows/react-prototype.yml`: tests in build and read-only comparator, uploads a sanitized evidence artifact. Existing native gate and Linux host configuration are unchanged.
