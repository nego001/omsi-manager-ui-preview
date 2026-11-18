# Phase 2 / M46 — External A/B/A intake protocol (no host changes)

## Verified starting point

[M45 CI #44224825603](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/44224825603) completed with **21/22 jobs approved** and **only** the mandatory strict native Ubuntu 24.04 X11 job failing. The same-run M45 sanitized review handoff was uploaded and reported:
- Ubuntu 22.04: 3/3 owned/mapped direct Electron X11 windows.
- Ubuntu 24.04: 0/3 owned/mapped X11 windows, 3/3 direct SIGTRAP exits.
- Ubuntu 22.04 user namespace probe allowed; Ubuntu 24.04 restricted and permission-denied.
- Ubuntu 24.04 M44 classified stderr as generic fatal, not a specific AppArmor denial.
- Eight administrative, provenance, policy scope, rollback, renderer isolation and native gate blockers remain.

These observations support **human review** of a potential app-specific AppArmor/namespace compatibility problem. They do not prove AppArmor caused the SIGTRAP.

## M46 goal

Turn that read-only evidence into an **operator-run A1 / B / A2 procedure** with a precise six-phase inventory across actual GNOME and KDE desktops. The new purely functional intake `auto-x11-m46-external-aba-intake.mjs` validates the existing M45 sanitized handoff and optionally validates a future *human-reported* A/B/A bundle using the existing M29 two-desktop comparison. Even a synthetically favorable three-phase pattern remains **untrusted and independently unauthenticated**.

The **GitHub Actions invocation always sets `externalPilot: null`**. No external pilot records are downloaded, invented or accepted in public CI. The M46 handoff explicitly reports that no A/B/A was carried out by GitHub Actions. It emits only two small, non-sensitive artifacts:
- `m46/operator-aba-intake.json`: fixed statuses, mandatory evidence categories, permanently false security/approval claims.
- `m46/operator-aba-runbook.md`: human-readable checklist of six A/B/A phases and independent evidence requirements.

The M46 report is published as `m46-aba-operator-protocol-sanitized` with 7-day retention. Its supporting CI test suite has **17 synthetic/adversarial tests**; any unknown field, forged approval, inconsistent phase, incorrect process ownership, contradictory digest, switched desktop or wrong scope is refused.

## Independent human execution requirements

1. **Before A1:** Administrator independently approves a disposable Ubuntu 24.04 VM, confirms authoritative host identity, change ownership, stable per-executable path, rollback snapshots and independent executable package-byte SHA-256 verification. GitHub's hash sidecar and GitHub runner labels alone do not certify a trusted release or VM.
2. **A1 / baseline:** On a genuine GNOME or KDE session, collect sanitized process, actual mapped/owned window and unprivileged namespace observations of both `OMSI-Manager-Auto` and packaged Electron, without changing policy. Compare with existing CI facts but do not assume identical host behavior.
3. **B / controlled pilot:** Only an authorized administrator, following a separate approved change procedure, may consider a narrowly app-specific policy. Never use `--no-sandbox`, root Electron, global AppArmor/userns restrictions disablement or blanket profile allowances. Capture window witnesses and **independent Chromium renderer sandbox confinement**; a working GUI does not certify sandboxing.
4. **A2 / rollback:** Remove any pilot change and verify the original host state and process behavior independently. An observed return of SIGTRAP is a reversible correlation, not proof of single-cause attribution.
5. **Review:** Preserve original raw evidence only in approved private administrative systems, if necessary; public CI receives **only sanitized categories**, not private paths, credentials, PIDs, raw stderr or profile contents. Independent human review is mandatory.
6. **Release gates:** A positive human report does not waive the mandatory Ubuntu 24.04 native X11 job, independent renderer confinement, desktop checks, authentic signed package or later real-mod/installation tests.

## Limits

No real pilot was carried out, authorized or simulated as true by M46. Public CI makes no AppArmor policy, kernel, sysctl, privileges, Electron sandbox, game/mod or merge changes. Existing Draft PRs, issue #4 and the native Ubuntu 24.04 strict gate remain blocking. An A/B/A observation bundle is at most a *human claim* until separate package identity, host identity, admin authorization, policy state, rollback and sandbox confinement are independently audited.
