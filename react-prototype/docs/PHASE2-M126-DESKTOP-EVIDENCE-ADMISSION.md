# M126 — desktop evidence review and admission decision

Date: 2026-11-24. Pinned head: 07e14cc1a2682a8ec14fa3fe5914830e7bbf42c8 (M125, draft PR #132).
Decision: **DESKTOP_EVIDENCE_INCOMPLETE / CONTENT_READ_BLOCKED / RELEASE_BLOCKED**.
This is a read-only evidence review, not an independent administrator or desktop certification.

## Completed exact CI evidence

M124 [45413410973](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413410973) and M125 [45413711697](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413711697) completed with overall failure. Each has exactly one failed job: Native Auto X11 real-window check on Ubuntu 24.04 (strict sandbox). All other jobs completed successfully. No waiver.

| M125 job | Observed result |
|---|---|
| [138514096887](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413711697/job/138514096887) | Linux build/security/browser/IPC, synthetic packaged ELF GUI, Auto X11 and disposable Weston Wayland smoke passed |
| [138514097421](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413711697/job/138514097421) | Windows unsigned portable package and real GUI smoke passed; security 350 passed / 16 skipped / 0 failed (366 declared); 19 packaged Electron modules checked; test/lab exclusions verified |
| [138514097414](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413711697/job/138514097414) | Standalone Win32 lab passed; 150 passed / 6 skipped / 0 failed (156 declared); M124 monotonic checkpoint and tracked handle disposal passed |
| [138520312068](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413711697/job/138520312068) | Ubuntu 22.04 strict X11 real-window job passed |
| [138520312005](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413711697/job/138520312005) | Ubuntu 24.04 strict X11 failed; both GNOME and KDE categories: baseline X11 mapped, Auto and direct Electron failed before window with SIGTRAP |
| [138521164381](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413711697/job/138521164381) | Same archive SHA256 observed on both runners; namespace probe allowed on Ubuntu22, permission-denied on Ubuntu24 with AppArmor restriction enabled; classification namespace-restriction-correlated-with-startup-failure; causality unproven |
| [138521236815](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413711697/job/138521236815) | Read-only direct comparison passed; M46 awaits admin authorization and external A/B/A records; no actual external pilot or independent renderer proof |
| [138520311834](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413711697/job/138520311834) | Arch Linux container ELF audit passed, no GUI |
| [138520311895](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413711697/job/138520311895) | Windows/Linux archive same-commit provenance audit passed; not package signature |
| [138514096988](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413711697/job/138514096988) | Exact draft head/base observed, no active rules, no CODEOWNERS on base, base protected flag false |
| [138514096380](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/45413711697/job/138514096380) | Zero submitted reviews and zero independent current-head approvals |

The 24.04 failure is correlated with restricted namespaces, not proof of AppArmor causation. Early main process kernel observations are not renderer confinement evidence. The successful comparison job is not the strict gate. No host changes or bypass applied.

## What is actually usable in the preview

Packaged native configuration selection is metadata-only, and the IPC E2E uses controlled picker responses. Native GUI smoke is not proof of genuine GNOME/KDE/Hyprland portal selection or native handle handoff. Weston is a disposable compositor and Arch container is not a CachyOS desktop. M121–M124 linked read/metadata/lifecycle fixture tests and M125 consent handoff are standalone/test-only; authorization flags remain false. No new real-content permission. Windows parent replacement and case-collision gaps remain; cooperative deadlines are not OS I/O deadlines.

## M126 admission checklist

| Required evidence | Status |
|---|---|
| Current Linux and Windows packaged preview build/GUI | Observed in hosted CI |
| Current Ubuntu22 strict native X11 | Passed |
| Current Ubuntu24 strict native X11 | Failed |
| Independent actual desktop picker/portal and cancellation | Not supplied |
| Independent renderer confinement | Not supplied |
| Administrator-approved disposable Ubuntu24 A/B/A pilot and rollback | Not supplied |
| Native selected-file and parent-handle provenance into packaged broker | Not implemented |
| Independent review and enforced branch protection | Not satisfied |

## Concrete next phase and operator boundary

1. Obtain separately authorized disposable desktop environment, actual package custody/hash and independent reviewer. No test on the user's daily workstation by default. Follow existing M46 intake/runbook; no host policy edit instructions in this change.
2. Exercise metadata-only selection on real desktop with self-created fixture, cancellation, navigation invalidation, changed selection, refusal of unsupported backend, no real mod contents and no write. Capture bounded categorical evidence, not personal paths, identifiers or raw contents.
3. Independently verify current strict Ubuntu24 native X11 and renderer confinement. If administrator elects a scoped policy pilot, require prior independent authorization, baseline/pilot/rollback evidence and actual current strict CI. No global disable, no no-sandbox flags, no weaker fallback.
4. Only after these gates, consider separately reviewed native broker/handle ownership design and explicit content vs dependency metadata authorization. Real mod content inspection, writes, repair, installation, deletion, merge and release remain blocked.

M127 recommended next: prepare a metadata-only desktop acceptance checklist and exact artifact-custody procedure for an independent operator; no further synthetic test milestones should be represented as resolving the missing external desktop evidence. If the required environment or independent authorization is unavailable, retain the blocked state and focus on preview-only usability. M126 does not implement the broker, modify source, change host security, or claim real desktop validation.
